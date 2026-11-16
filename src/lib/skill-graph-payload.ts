// Normalisation for `POST /api/me/skill-graph`.
//
// The table is keyed by (roadmap_id, topic). Postgres rejects a single upsert
// statement that touches the same conflict key twice ("ON CONFLICT DO UPDATE
// command cannot affect row a second time"), so a roadmap with two lessons
// titled "Capstone" used to fail the whole write with a 500 and the skill graph
// was never saved. Dedupe before building the statement.
//
// The client posts `SkillNodeRecord` (snake_case) while the route originally
// read `lessonId`, so every lesson link silently became null. Accept both.

export type SkillNodeInput = {
  topic?: unknown
  lessonId?: unknown
  lesson_id?: unknown
  difficulty?: unknown
  prerequisites?: unknown
}

export type SkillNodeRow = {
  roadmap_id: string
  lesson_id: string | null
  topic: string
  difficulty: string | null
  prerequisites: string[]
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && !!item) : []
}

/**
 * Rows ready for `from("skill_nodes").upsert(...)`, deduped by topic.
 * Entries without a usable topic are dropped instead of failing the batch.
 * `allowedLessonIds`, when provided, nulls out lesson links that do not belong
 * to this roadmap (a client cannot attach a lesson from someone else's plan).
 */
export function normalizeSkillNodes(
  roadmapId: string,
  nodes: SkillNodeInput[],
  allowedLessonIds?: ReadonlySet<string>
): SkillNodeRow[] {
  const byTopic = new Map<string, SkillNodeRow>()
  for (const node of nodes ?? []) {
    const topic = asString(node?.topic)
    if (!topic) continue
    const lessonId = asString(node.lessonId) ?? asString(node.lesson_id)
    byTopic.set(topic, {
      roadmap_id: roadmapId,
      lesson_id: lessonId && (!allowedLessonIds || allowedLessonIds.has(lessonId)) ? lessonId : null,
      topic,
      difficulty: asString(node.difficulty),
      prerequisites: asStringArray(node.prerequisites),
    })
  }
  return [...byTopic.values()]
}
