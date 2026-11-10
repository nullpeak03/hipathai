-- Practice retakes of a passed phase checkpoint must never revoke the pass,
-- downgrade its stored score, or inflate its attempt count. Only a first pass
-- advances the checkpoint, and a later better pass may raise the stored score.
--
-- Also expose the correct option index in graded results so the checkpoint
-- review can show the right answer for questions the learner missed.

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
        'correctIndex', (v_question ->> 'correct')::integer,
        'explanation', coalesce(v_question ->> 'explanation', '')
      ));
    else
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'correct', false,
        'correctIndex', (v_question ->> 'correct')::integer,
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
            -- Once passed, keep the best passing score. A practice retake
            -- cannot lower it, and a better pass can still raise it.
            score = case
              when phase_exam_progress.passed
                then greatest(coalesce(phase_exam_progress.score, 0), excluded.score)
              else excluded.score
            end,
            -- Passed checkpoints stop counting attempts; practice retakes are
            -- not new unlock attempts.
            attempts = case
              when phase_exam_progress.passed then phase_exam_progress.attempts
              else phase_exam_progress.attempts + 1
            end,
            updated_at = now();
  end if;

  return v_result;
end;
$$;

revoke all on function submit_quiz_assessment(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function submit_quiz_assessment(uuid, text, jsonb) to service_role;
