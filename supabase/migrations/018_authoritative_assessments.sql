-- Store issued quiz snapshots server-side so answer keys never need to be sent
-- to the browser and scores/progression are computed from trusted questions.
create table if not exists quiz_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  lesson_id uuid references lessons(id) on delete cascade,
  phase_id uuid references phases(id) on delete cascade,
  mode text not null check (mode in ('standard', 'remedial', 'challenge', 'phase')),
  questions jsonb not null,
  answers jsonb,
  score integer check (score >= 0 and score <= 100),
  passed boolean,
  result jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  submitted_at timestamptz,
  check ((lesson_id is not null and phase_id is null) or (lesson_id is null and phase_id is not null))
);

create index if not exists quiz_assessments_user_created_idx
  on quiz_assessments(user_id, created_at desc);
create index if not exists quiz_assessments_expiry_idx
  on quiz_assessments(expires_at) where submitted_at is null;

-- Assessment and progression writes are server-authoritative. Previous
-- owner-scoped "FOR ALL" policies still allowed a learner to edit their own
-- scores, unlocks, XP, and mastery directly through Supabase.
drop policy if exists gamification_own on gamification;
drop policy if exists progress_own on progress;
drop policy if exists quiz_attempts_own on quiz_attempts;
drop policy if exists phase_exam_own on phase_exam_progress;
drop policy if exists learner_mastery_own on learner_mastery;
drop policy if exists weak_topics_own on weak_topics;
drop policy if exists phases_via_roadmap on phases;
drop policy if exists lessons_via_roadmap on lessons;

drop policy if exists gamification_read_own on gamification;
drop policy if exists progress_read_own on progress;
drop policy if exists quiz_attempts_read_own on quiz_attempts;
drop policy if exists phase_exam_read_own on phase_exam_progress;
drop policy if exists learner_mastery_read_own on learner_mastery;
drop policy if exists weak_topics_read_own on weak_topics;

create policy gamification_read_own on gamification
  for select to authenticated using (user_id = (auth.jwt() ->> 'sub'));
create policy progress_read_own on progress
  for select to authenticated using (user_id = (auth.jwt() ->> 'sub'));
create policy quiz_attempts_read_own on quiz_attempts
  for select to authenticated using (user_id = (auth.jwt() ->> 'sub'));
create policy phase_exam_read_own on phase_exam_progress
  for select to authenticated using (user_id = (auth.jwt() ->> 'sub'));
create policy learner_mastery_read_own on learner_mastery
  for select to authenticated using (user_id = (auth.jwt() ->> 'sub'));
create policy weak_topics_read_own on weak_topics
  for select to authenticated using (user_id = (auth.jwt() ->> 'sub'));

alter table quiz_assessments enable row level security;
-- No client policy: snapshots include answer keys and are accessed only by
-- authenticated API routes using the service-role client.

create or replace function submit_quiz_assessment(
  p_assessment_id uuid,
  p_user_id text,
  p_answers jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment quiz_assessments%rowtype;
  v_progress progress%rowtype;
  v_phase_progress phase_exam_progress%rowtype;
  v_gamification gamification%rowtype;
  v_question jsonb;
  v_answer text;
  v_count integer;
  v_correct integer := 0;
  v_score integer;
  v_passed boolean;
  v_first_pass boolean := false;
  v_today date := (now() at time zone 'UTC')::date;
  v_streak integer;
  v_xp integer;
  v_attempts integer;
  v_mastery_score integer;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
  i integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id, 0));

  select * into v_assessment
    from quiz_assessments
    where id = p_assessment_id and user_id = p_user_id
    for update;

  if not found then
    raise exception 'assessment_not_found';
  end if;

  if v_assessment.submitted_at is not null then
    return coalesce(v_assessment.result, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;
  if v_assessment.expires_at <= now() then
    raise exception 'assessment_expired';
  end if;
  if jsonb_typeof(p_answers) <> 'object' then
    raise exception 'invalid_answers';
  end if;

  v_count := jsonb_array_length(v_assessment.questions);
  if v_count < 1 then
    raise exception 'empty_assessment';
  end if;

  for i in 0..v_count - 1 loop
    v_question := v_assessment.questions -> i;
    v_answer := p_answers ->> i::text;
    if v_answer is null or v_answer !~ '^[0-9]+$'
      or v_answer::integer < 0
      or v_answer::integer >= jsonb_array_length(v_question -> 'options') then
      raise exception 'incomplete_or_invalid_answers';
    end if;
    if v_answer::integer = (v_question ->> 'correct')::integer then
      v_correct := v_correct + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'correct', true,
        'explanation', coalesce(v_question ->> 'explanation', '')
      ));
    else
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'correct', false,
        'explanation', coalesce(v_question ->> 'explanation', '')
      ));
    end if;
  end loop;

  if (select count(*) from jsonb_object_keys(p_answers)) <> v_count then
    raise exception 'invalid_answer_count';
  end if;

  v_score := round((v_correct::numeric / v_count) * 100)::integer;
  v_passed := v_score >= 60;
  v_result := jsonb_build_object(
    'assessmentId', p_assessment_id,
    'score', v_score,
    'passed', v_passed,
    'mastered', v_score >= 90,
    'results', v_results
  );

  update quiz_assessments
    set answers = p_answers,
        score = v_score,
        passed = v_passed,
        result = v_result,
        submitted_at = now()
    where id = p_assessment_id;

  if v_assessment.lesson_id is not null then
    if v_assessment.mode <> 'challenge' then
      insert into quiz_attempts(user_id, lesson_id, quiz_id, answers, score, passed)
        values (p_user_id, v_assessment.lesson_id, p_assessment_id::text, p_answers, v_score, v_passed);

      select * into v_progress
        from progress
        where user_id = p_user_id and lesson_id = v_assessment.lesson_id
        for update;
      v_first_pass := v_passed and (not found or not coalesce(v_progress.passed, false));

      insert into progress(user_id, lesson_id, completed, passed, score)
        values (p_user_id, v_assessment.lesson_id, true, v_passed, v_score)
        on conflict (user_id, lesson_id) do update
          set completed = true,
              passed = progress.passed or excluded.passed,
              score = excluded.score,
              updated_at = now();

      select count(*) into v_attempts from quiz_attempts
        where user_id = p_user_id and lesson_id = v_assessment.lesson_id;
      v_mastery_score := greatest(0, v_score - greatest(0, v_attempts - 1) * 3);
      insert into learner_mastery(
        user_id, roadmap_id, lesson_id, topic, mastery_score, attempts,
        last_practiced_at, updated_at
      )
      select p_user_id, l.roadmap_id, l.id, l.title, v_mastery_score, v_attempts, now(), now()
        from lessons l where l.id = v_assessment.lesson_id
      on conflict (user_id, roadmap_id, topic) do update
        set mastery_score = excluded.mastery_score,
            attempts = excluded.attempts,
            last_practiced_at = excluded.last_practiced_at,
            updated_at = excluded.updated_at;

      if not v_passed then
        insert into weak_topics(user_id, topic, fail_count)
          select p_user_id, l.title, 1 from lessons l where l.id = v_assessment.lesson_id
        on conflict (user_id, topic) do update
          set fail_count = weak_topics.fail_count + 1;
      end if;

      select * into v_gamification from gamification
        where user_id = p_user_id for update;
      v_xp := coalesce(v_gamification.xp, 0) + case when v_first_pass then 20 else 0 end;
      v_streak := case
        when v_gamification.last_study_date = v_today then coalesce(v_gamification.streak, 0)
        when v_gamification.last_study_date = v_today - 1 then coalesce(v_gamification.streak, 0) + 1
        else 1
      end;
      insert into gamification(
        user_id, xp, level, streak, best_streak, pass_rate, study_minutes,
        lessons_done, last_study_date, updated_at
      )
      select p_user_id, v_xp,
        case when v_xp >= 1500 then 6 when v_xp >= 1000 then 5
             when v_xp >= 600 then 4 when v_xp >= 300 then 3
             when v_xp >= 100 then 2 else 1 end,
        v_streak, greatest(coalesce(v_gamification.best_streak, 0), v_streak),
        case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where passed) / count(*))::integer end,
        coalesce(v_gamification.study_minutes, 0) + case when v_passed then 15 else 5 end,
        (select count(*) from progress where user_id = p_user_id and passed),
        v_today, now()
      from quiz_attempts where user_id = p_user_id
      on conflict (user_id) do update set
        xp = excluded.xp,
        level = excluded.level,
        streak = excluded.streak,
        best_streak = excluded.best_streak,
        pass_rate = excluded.pass_rate,
        study_minutes = excluded.study_minutes,
        lessons_done = excluded.lessons_done,
        last_study_date = excluded.last_study_date,
        updated_at = now();
    end if;
  else
    select * into v_phase_progress from phase_exam_progress
      where user_id = p_user_id and phase_id = v_assessment.phase_id
      for update;
    v_attempts := case when found then coalesce(v_phase_progress.attempts, 0) + 1 else 1 end;
    insert into phase_exam_progress(user_id, phase_id, passed, score, attempts, updated_at)
      values (p_user_id, v_assessment.phase_id, v_passed, v_score, v_attempts, now())
      on conflict (user_id, phase_id) do update
        set passed = phase_exam_progress.passed or excluded.passed,
            score = excluded.score,
            attempts = phase_exam_progress.attempts + 1,
            updated_at = now();
  end if;

  return v_result;
end;
$$;

revoke all on function submit_quiz_assessment(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function submit_quiz_assessment(uuid, text, jsonb) to service_role;

create table if not exists quick_check_awards (
  user_id text not null references users(clerk_id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  section_index integer not null check (section_index >= 0),
  awarded_at timestamptz not null default now(),
  primary key (user_id, lesson_id, section_index)
);
alter table quick_check_awards enable row level security;

create or replace function award_quick_check(
  p_user_id text,
  p_lesson_id uuid,
  p_section_index integer,
  p_answer integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content jsonb;
  v_check jsonb;
  v_correct integer;
  v_awarded boolean := false;
  v_xp integer;
begin
  select l.content_json into v_content
    from lessons l
    join roadmaps r on r.id = l.roadmap_id
    where l.id = p_lesson_id and r.user_id = p_user_id;
  if not found then
    raise exception 'lesson_not_found';
  end if;

  v_check := v_content -> 'sections' -> p_section_index;
  if coalesce(v_check ->> 'type', '') <> 'check' then
    raise exception 'quick_check_not_found';
  end if;
  v_correct := (v_check ->> 'correct')::integer;

  if p_answer = v_correct then
    insert into quick_check_awards(user_id, lesson_id, section_index)
      values (p_user_id, p_lesson_id, p_section_index)
      on conflict do nothing;
    v_awarded := found;
    if v_awarded then
      insert into gamification(user_id, xp, level, updated_at)
        values (p_user_id, 1, 1, now())
      on conflict (user_id) do update
        set xp = gamification.xp + 1,
            level = case when gamification.xp + 1 >= 1500 then 6
                         when gamification.xp + 1 >= 1000 then 5
                         when gamification.xp + 1 >= 600 then 4
                         when gamification.xp + 1 >= 300 then 3
                         when gamification.xp + 1 >= 100 then 2 else 1 end,
            updated_at = now()
      returning xp into v_xp;
    else
      select xp into v_xp from gamification where user_id = p_user_id;
    end if;
  else
    select xp into v_xp from gamification where user_id = p_user_id;
  end if;

  return jsonb_build_object('correct', p_answer = v_correct, 'awarded', v_awarded, 'xp', coalesce(v_xp, 0));
end;
$$;

revoke all on function award_quick_check(text, uuid, integer, integer) from public, anon, authenticated;
grant execute on function award_quick_check(text, uuid, integer, integer) to service_role;
