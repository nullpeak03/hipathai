// Production: Supabase-backed (shared across Vercel instances), fallback to in-memory.
// 20 AI calls/user/day, 5 roadmaps/week, tutor 30 msgs/day.

const dayHits = new Map<string, { n: number; reset: number }>();
const weekHits = new Map<string, { n: number; reset: number }>();
const tutorHits = new Map<string, { n: number; reset: number }>();

function bumpMem(map: Map<string, { n: number; reset: number }>, key: string, limit: number, windowMs: number) {
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

async function bumpDb(userId: string, window: "ai_day" | "roadmap_week" | "tutor_day", limit: number, windowMs: number): Promise<{ ok: boolean; remaining: number }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return bumpMem(window === "ai_day" ? dayHits : window === "roadmap_week" ? weekHits : tutorHits, `${window}:${userId}`, limit, windowMs);
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowMs);
    // Try to get existing
    const { data } = await sb.from("rate_limits").select("count,reset_at").eq("user_id", userId).eq("window", window).maybeSingle();
    if (!data || new Date(data.reset_at as string).getTime() < now.getTime()) {
      await sb.from("rate_limits").upsert({ user_id: userId, window, count: 1, reset_at: resetAt.toISOString() }, { onConflict: "user_id,window" });
      return { ok: true, remaining: limit - 1 };
    }
    const count = data.count as number;
    if (count >= limit) return { ok: false, remaining: 0 };
    await sb.from("rate_limits").update({ count: count + 1 }).eq("user_id", userId).eq("window", window);
    return { ok: true, remaining: limit - (count + 1) };
  } catch {
    return bumpMem(window === "ai_day" ? dayHits : window === "roadmap_week" ? weekHits : tutorHits, `${window}:${userId}`, limit, windowMs);
  }
}

export function checkAiDay(key: string) {
  // Sync fallback for non-async callers (kept for backward compat, but prefer async)
  return bumpMem(dayHits, `ai:${key}`, 20, 24 * 3600 * 1000);
}
export function checkRoadmapWeek(key: string) {
  return bumpMem(weekHits, `rm:${key}`, 5, 7 * 24 * 3600 * 1000);
}
export function checkTutorDay(key: string) {
  return bumpMem(tutorHits, `tutor:${key}`, 30, 24 * 3600 * 1000);
}
export function checkAiDayAsync(key: string) {
  return bumpDb(key, "ai_day", 20, 24 * 3600 * 1000);
}
export function checkRoadmapWeekAsync(key: string) {
  return bumpDb(key, "roadmap_week", 5, 7 * 24 * 3600 * 1000);
}
export function checkTutorDayAsync(key: string) {
  return bumpDb(key, "tutor_day", 30, 24 * 3600 * 1000);
}
export function isAnon(key: string) {
  return key.startsWith("anon:");
}
