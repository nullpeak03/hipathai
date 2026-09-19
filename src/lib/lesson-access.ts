import type { createServerClient } from "@/lib/supabase/server"

type ServerClient = ReturnType<typeof createServerClient>

/**
 * Verify a lesson belongs to the caller's roadmap. Service-role queries
 * bypass RLS, so every lesson-scoped endpoint must call this before
 * reading lesson content (prevents cross-user reads via ID enumeration).
 */
export async function userOwnsLesson(
  db: ServerClient,
  userId: string,
  lessonId: string
): Promise<boolean> {
  const { data: lesson } = await db
    .from("lessons")
    .select("roadmap_id")
    .eq("id", lessonId)
    .single()
  if (!lesson) return false
  const roadmapId = (lesson as { roadmap_id: string }).roadmap_id
  const { data: roadmap } = await db
    .from("roadmaps")
    .select("user_id")
    .eq("id", roadmapId)
    .single()
  if (!roadmap) return false
  return (roadmap as { user_id: string }).user_id === userId
}
