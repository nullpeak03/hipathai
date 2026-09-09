// M1b in-memory guards (plan.md caps). Replaced by Supabase counters in M5.
// 20 AI calls/user/day, 5 roadmaps/week, tutor 30 msgs/day.

const dayHits = new Map<string, { n: number; reset: number }>();
const weekHits = new Map<string, { n: number; reset: number }>();
const tutorHits = new Map<string, { n: number; reset: number }>();

function bump(map: Map<string, { n: number; reset: number }>, key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const cur = map.get(key);
  if (!cur || now > cur.reset) {
    map.set(key, { n: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (cur.n >= limit) return { ok: false, remaining: 0 };
  cur.n += 1;
  return { ok: true, remaining: limit - cur.n };
}

export function checkAiDay(key: string) {
  return bump(dayHits, `ai:${key}`, 20, 24 * 3600 * 1000);
}

export function checkRoadmapWeek(key: string) {
  return bump(weekHits, `rm:${key}`, 5, 7 * 24 * 3600 * 1000);
}

export function checkTutorDay(key: string) {
  return bump(tutorHits, `tutor:${key}`, 30, 24 * 3600 * 1000);
}
