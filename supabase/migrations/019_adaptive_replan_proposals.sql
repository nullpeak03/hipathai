alter table roadmap_revisions
  add column if not exists proposal_id uuid references replan_proposals(id) on delete set null,
  add column if not exists changes jsonb not null default '{}'::jsonb;

create unique index if not exists roadmap_revisions_proposal_idx
  on roadmap_revisions(proposal_id)
  where proposal_id is not null;

create or replace function apply_replan_proposal(
  p_proposal_id uuid,
  p_user_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal replan_proposals%rowtype;
  v_topics jsonb;
  v_topic_record record;
  v_topic text;
  v_current_failures integer;
  v_phase_id uuid;
  v_phase_idx integer;
  v_previous_lesson_id uuid;
  v_lesson_id uuid;
  v_job_id uuid;
  v_lesson_ids jsonb := '[]'::jsonb;
  v_jobs jsonb := '[]'::jsonb;
  v_topic_names jsonb := '[]'::jsonb;
  v_application jsonb;
begin
  select * into v_proposal
    from replan_proposals
    where id = p_proposal_id and user_id = p_user_id
    for update;

  if not found then
    raise exception 'proposal_not_found';
  end if;

  if v_proposal.status = 'applied' then
    return coalesce(v_proposal.proposed_changes -> 'application', '{}'::jsonb)
      || jsonb_build_object('duplicate', true);
  end if;
  if v_proposal.status <> 'pending' then
    raise exception 'proposal_not_pending';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_proposal.roadmap_id::text, 0));

  if not exists (
    select 1 from roadmaps
    where id = v_proposal.roadmap_id and user_id = p_user_id
  ) then
    raise exception 'roadmap_not_found';
  end if;

  v_topics := v_proposal.proposed_changes -> 'topics';
  if coalesce(jsonb_typeof(v_topics) <> 'array', true) then
    raise exception 'proposal_has_no_topics';
  end if;
  if jsonb_array_length(v_topics) < 1 or jsonb_array_length(v_topics) > 8 then
    raise exception 'proposal_has_no_topics';
  end if;

  if (
    select count(distinct lower(value ->> 'topic'))
    from jsonb_array_elements(v_topics) as entries(value)
  ) <> jsonb_array_length(v_topics) then
    raise exception 'proposal_has_duplicate_topics';
  end if;

  select coalesce(max(idx), 0) + 1 into v_phase_idx
    from phases where roadmap_id = v_proposal.roadmap_id;

  insert into phases(roadmap_id, idx, title)
    values (v_proposal.roadmap_id, v_phase_idx, 'Focused practice')
    returning id into v_phase_id;

  for v_topic_record in
    select value from jsonb_array_elements(v_topics) as entries(value)
  loop
    v_topic := nullif(trim(v_topic_record.value ->> 'topic'), '');
    if v_topic is null or length(v_topic) > 160 then
      raise exception 'invalid_proposal_topic';
    end if;

    select fail_count into v_current_failures
      from weak_topics
      where user_id = p_user_id and lower(topic) = lower(v_topic)
      order by fail_count desc
      limit 1;
    if not found or coalesce(v_current_failures, 0) < 3 then
      raise exception 'proposal_outdated';
    end if;

    if not exists (
      select 1 from lessons
      where roadmap_id = v_proposal.roadmap_id
        and lower(title) = lower(v_topic)
    ) then
      raise exception 'proposal_topic_not_in_roadmap';
    end if;

    if exists (
      select 1
      from roadmap_revisions revision,
           jsonb_array_elements_text(coalesce(revision.changes -> 'topics', '[]'::jsonb)) as applied(topic)
      where revision.roadmap_id = v_proposal.roadmap_id
        and lower(applied.topic) = lower(v_topic)
    ) then
      raise exception 'proposal_topic_already_applied';
    end if;

    insert into lessons(
      roadmap_id, phase_id, idx, title, content_md, prerequisites
    ) values (
      v_proposal.roadmap_id,
      v_phase_id,
      jsonb_array_length(v_lesson_ids) + 1,
      'Practice: ' || v_topic,
      '## Focused practice: ' || v_topic || E'\n\nPractice ' || v_topic || ' with a guided explanation and exercises.',
      case when v_previous_lesson_id is null then '[]'::jsonb else jsonb_build_array(v_previous_lesson_id::text) end
    ) returning id into v_lesson_id;

    v_job_id := gen_random_uuid();
    v_lesson_ids := v_lesson_ids || jsonb_build_array(v_lesson_id);
    v_jobs := v_jobs || jsonb_build_array(jsonb_build_object(
      'lessonId', v_lesson_id,
      'jobId', v_job_id
    ));
    v_topic_names := v_topic_names || jsonb_build_array(v_topic);
    v_previous_lesson_id := v_lesson_id;
  end loop;

  insert into roadmap_revisions(
    roadmap_id, user_id, proposal_id, reason, changes
  ) values (
    v_proposal.roadmap_id,
    p_user_id,
    p_proposal_id,
    v_proposal.reason,
    jsonb_build_object(
      'type', 'focused-practice',
      'topics', v_topic_names,
      'phaseId', v_phase_id,
      'lessonIds', v_lesson_ids
    )
  );

  v_application := jsonb_build_object(
    'phaseId', v_phase_id,
    'lessonIds', v_lesson_ids,
    'jobs', v_jobs,
    'topics', v_topic_names
  );

  update replan_proposals
    set status = 'applied',
        decided_at = now(),
        proposed_changes = proposed_changes || jsonb_build_object('application', v_application)
    where id = p_proposal_id;

  return v_application;
end;
$$;

revoke all on function apply_replan_proposal(uuid, text) from public, anon, authenticated;
grant execute on function apply_replan_proposal(uuid, text) to service_role;
