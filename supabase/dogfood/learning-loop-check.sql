-- Learning-loop dogfood check.
--
-- Exercises the real grading function (`submit_quiz_assessment`) against real
-- generated content and asserts every state transition the learning loop
-- depends on:
--
--   fail  -> progress not passed, mastery = greatest(0, 50 - 3*(prior attempts)),
--            weak_topics[lesson] increments
--   pass  -> progress passed, score 100, mastered, attempts advance
--
-- Everything happens inside ONE transaction that ends in ROLLBACK, so it can
-- be run against production without changing a single row. Run it with psql
-- (or paste the whole file into the Supabase SQL editor):
--
--   psql "$DIRECT_URL" -f supabase/dogfood/learning-loop-check.sql
--
-- A failed assertion raises an exception and aborts the transaction.

begin;

do $$
declare
  v_lesson uuid;
  v_roadmap uuid;
  v_user text;
  v_title text;
  v_fail_id uuid;
  v_pass_id uuid;
  v_res jsonb;
  v_attempts_before integer;
  v_mastery numeric;
  v_weak integer;
  v_passed boolean;
  v_score integer;
  v_attempts integer;
begin
  select l.id, l.roadmap_id, r.user_id, l.title
    into v_lesson, v_roadmap, v_user, v_title
    from lessons l
    join roadmaps r on r.id = l.roadmap_id
   where l.content_json is not null
     and r.user_id is not null
   order by l.id
   limit 1;

  if v_lesson is null then
    raise exception 'dogfood: no generated lesson with an owner found';
  end if;

  select count(*) into v_attempts_before
    from quiz_attempts where user_id = v_user and lesson_id = v_lesson;

  -- --- failing attempt (1 of 2 correct = 50) ------------------------------
  insert into quiz_assessments(user_id, lesson_id, mode, questions, expires_at)
  values (
    v_user, v_lesson, 'standard',
    '[{"prompt":"dogfood 1","options":["a","b"],"correct":0},
      {"prompt":"dogfood 2","options":["a","b"],"correct":0}]'::jsonb,
    now() + interval '1 hour'
  )
  returning id into v_fail_id;

  v_res := submit_quiz_assessment(v_fail_id, v_user, '{"0":"0","1":"1"}'::jsonb);

  if (v_res ->> 'score')::integer <> 50 or (v_res ->> 'passed')::boolean then
    raise exception 'dogfood: expected a 50%% fail, got %', v_res;
  end if;

  select mastery_score into v_mastery
    from learner_mastery
   where user_id = v_user and roadmap_id = v_roadmap and lesson_id = v_lesson;
  if v_mastery is distinct from greatest(0, 50 - 3 * v_attempts_before) then
    raise exception 'dogfood: mastery after fail = % (expected %)',
      v_mastery, greatest(0, 50 - 3 * v_attempts_before);
  end if;

  select fail_count into v_weak
    from weak_topics where user_id = v_user and topic = v_title;
  if v_weak is null or v_weak < 1 then
    raise exception 'dogfood: weak_topics did not record the failed lesson';
  end if;

  -- --- passing attempt ----------------------------------------------------
  insert into quiz_assessments(user_id, lesson_id, mode, questions, expires_at)
  values (
    v_user, v_lesson, 'standard',
    '[{"prompt":"dogfood 1","options":["a","b"],"correct":0},
      {"prompt":"dogfood 2","options":["a","b"],"correct":0}]'::jsonb,
    now() + interval '1 hour'
  )
  returning id into v_pass_id;

  v_res := submit_quiz_assessment(v_pass_id, v_user, '{"0":"0","1":"0"}'::jsonb);

  if (v_res ->> 'score')::integer <> 100
     or not (v_res ->> 'passed')::boolean
     or not (v_res ->> 'mastered')::boolean then
    raise exception 'dogfood: expected a 100%% mastered pass, got %', v_res;
  end if;

  select passed, score into v_passed, v_score
    from progress where user_id = v_user and lesson_id = v_lesson;
  if not coalesce(v_passed, false) or v_score <> 100 then
    raise exception 'dogfood: progress not marked passed (passed=%, score=%)', v_passed, v_score;
  end if;

  select attempts into v_attempts
    from learner_mastery
   where user_id = v_user and roadmap_id = v_roadmap and lesson_id = v_lesson;
  if v_attempts <> v_attempts_before + 2 then
    raise exception 'dogfood: expected % attempts, got %', v_attempts_before + 2, v_attempts;
  end if;

  raise notice 'dogfood OK — lesson %, fail->50, pass->100, mastery %, attempts %, weak_count %',
    v_title, v_mastery, v_attempts, v_weak;
end;
$$;

rollback;
