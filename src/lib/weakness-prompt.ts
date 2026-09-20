// AI remediation suggestions for failed quizzes (Groq fast model).
// Short, actionable, plain text — rendered inline in the lesson fail panel.

export type WeaknessPromptInput = {
  topic: string
  score: number
  failCount: number
}

export function buildWeaknessPrompt({ topic, score, failCount }: WeaknessPromptInput): string {
  const repeated = failCount > 1 ? ` They have now failed this topic ${failCount} times — adjust for frustration, stay encouraging.` : ""
  return `A student scored ${score}% on a quiz about "${topic}".${repeated} Explain the most likely misunderstanding in 2 sentences, then on its own line write RECOMMENDATION: followed by one concrete study tip they can do in under 15 minutes. Keep the whole reply under 120 words, plain text, no markdown.`
}
