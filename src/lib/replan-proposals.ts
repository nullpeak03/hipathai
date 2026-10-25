export type WeakTopicSignal = { topic: string; fail_count: number }
export type ProposedPracticeTopic = { topic: string; failCount: number }

export function eligiblePracticeTopics(
  lessonTitles: string[],
  weakTopics: WeakTopicSignal[],
  previouslyApplied: string[]
): ProposedPracticeTopic[] {
  const titleByKey = new Map(lessonTitles.map((title) => [title.trim().toLocaleLowerCase(), title.trim()]))
  const applied = new Set(previouslyApplied.map((topic) => topic.trim().toLocaleLowerCase()))
  const seen = new Set<string>()
  return weakTopics.flatMap(({ topic, fail_count }) => {
    const key = topic.trim().toLocaleLowerCase()
    const title = titleByKey.get(key)
    if (!title || fail_count < 3 || applied.has(key) || seen.has(key)) return []
    seen.add(key)
    return [{ topic: title, failCount: fail_count }]
  })
}
