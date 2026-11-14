// Request validation for the AI tutor endpoints.
//
// The handler previously cast `req.json()` and trusted it, so a signed-in
// user could send an unbounded message array, multi-megabyte strings, or a
// malformed `images` value. Everything now passes through here before any
// database or provider call.

import type { TutorContext } from "./tutor-prompt"

export const MAX_CHAT_MESSAGES = 40
export const MAX_MESSAGE_CHARS = 8_000
export const MAX_CHAT_CHARS = 32_000
export const MAX_CONTEXT_LESSON_CHARS = 4_000
export const MAX_TUTOR_IMAGES = 4

export type ChatMessageInput = { role: "user" | "assistant"; content: string }

export type ChatInput = {
  messages: ChatMessageInput[]
  context: TutorContext | undefined
  threadId: string | undefined
  images: string[] | undefined
}

export type ChatInputResult =
  | { ok: true; value: ChatInput }
  | { ok: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function boundedString(value: unknown, maxChars: number): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > maxChars) return undefined
  return trimmed
}

function boundedNumber(value: unknown, min: number, max: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined
}

function stringList(value: unknown, maxItems: number, maxChars: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out = value
    .slice(0, maxItems)
    .filter((item): item is string => typeof item === "string" && item.length > 0 && item.length <= maxChars)
  return out.length > 0 ? out : undefined
}

/**
 * Keep only the fields the prompt builder understands, with bounded sizes.
 * Invalid context is dropped field-by-field rather than failing the request:
 * context is advisory, while a bad answer is worse than a smaller prompt.
 */
function sanitizeContext(value: unknown): TutorContext | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const context: TutorContext = {}

  const roadmapTitle = boundedString(raw.roadmapTitle, 200)
  if (roadmapTitle) context.roadmapTitle = roadmapTitle
  const lessonTitle = boundedString(raw.lessonTitle, 200)
  if (lessonTitle) context.lessonTitle = lessonTitle
  const lessonContent = boundedString(raw.lessonContent, MAX_CONTEXT_LESSON_CHARS)
  if (lessonContent) context.lessonContent = lessonContent

  const level = boundedNumber(raw.level, 1, 1_000)
  if (level !== undefined) context.level = level
  const xp = boundedNumber(raw.xp, 0, 100_000_000)
  if (xp !== undefined) context.xp = xp
  const streak = boundedNumber(raw.streak, 0, 100_000)
  if (streak !== undefined) context.streak = streak
  const lessonsDone = boundedNumber(raw.lessonsDone, 0, 100_000)
  if (lessonsDone !== undefined) context.lessonsDone = lessonsDone
  const totalLessons = boundedNumber(raw.totalLessons, 0, 100_000)
  if (totalLessons !== undefined) context.totalLessons = totalLessons
  const minutesSinceLastStudy = boundedNumber(raw.minutesSinceLastStudy, 0, 10_000_000)
  if (minutesSinceLastStudy !== undefined) context.minutesSinceLastStudy = minutesSinceLastStudy

  const weakTopics = stringList(raw.weakTopics, 20, 80)
  if (weakTopics) context.weakTopics = weakTopics
  const lowMasteryTopics = stringList(raw.lowMasteryTopics, 20, 80)
  if (lowMasteryTopics) context.lowMasteryTopics = lowMasteryTopics

  if (Array.isArray(raw.phases)) {
    const phases = raw.phases
      .slice(0, 30)
      .flatMap((phase) => {
        if (!phase || typeof phase !== "object" || Array.isArray(phase)) return []
        const p = phase as Record<string, unknown>
        const title = boundedString(p.title, 120)
        if (!title) return []
        const lessons = Array.isArray(p.lessons)
          ? p.lessons
              .slice(0, 200)
              .flatMap((lesson) => {
                if (!lesson || typeof lesson !== "object" || Array.isArray(lesson)) return []
                const l = lesson as Record<string, unknown>
                const n = boundedNumber(l.n, 1, 100_000)
                const ltitle = boundedString(l.title, 200)
                if (n === undefined || !ltitle) return []
                return [{ n, title: ltitle, done: l.done === true }]
              })
          : []
        return [{ title, lessons }]
      })
    if (phases.length > 0) context.phases = phases
  }

  if (raw.currentLesson === null) {
    context.currentLesson = null
  } else if (raw.currentLesson && typeof raw.currentLesson === "object" && !Array.isArray(raw.currentLesson)) {
    const current = raw.currentLesson as Record<string, unknown>
    const n = boundedNumber(current.n, 1, 100_000)
    const title = boundedString(current.title, 200)
    if (n !== undefined && title) context.currentLesson = { n, title }
  }

  if (Array.isArray(raw.recentScores)) {
    const recentScores = raw.recentScores
      .slice(0, 10)
      .flatMap((score) => {
        if (!score || typeof score !== "object" || Array.isArray(score)) return []
        const s = score as Record<string, unknown>
        const lessonTitle = boundedString(s.lessonTitle, 200)
        const value = boundedNumber(s.score, 0, 100)
        if (!lessonTitle || value === undefined) return []
        return [{ lessonTitle, score: value, passed: s.passed === true }]
      })
    if (recentScores.length > 0) context.recentScores = recentScores
  }

  if (raw.tutorMode === "direct" || raw.tutorMode === "socratic") {
    context.tutorMode = raw.tutorMode
  }

  return context
}

/** Validate and normalize a tutor request body. */
export function validateChatInput(body: unknown): ChatInputResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request." }
  }
  const raw = body as Record<string, unknown>

  if (!Array.isArray(raw.messages) || raw.messages.length === 0) {
    return { ok: false, error: "Send at least one message." }
  }
  if (raw.messages.length > MAX_CHAT_MESSAGES) {
    return { ok: false, error: `Conversations are limited to ${MAX_CHAT_MESSAGES} messages per request.` }
  }

  let totalChars = 0
  let hasUserMessage = false
  const messages: ChatMessageInput[] = []
  for (const entry of raw.messages) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { ok: false, error: "One or more messages are invalid." }
    }
    const message = entry as Record<string, unknown>
    if (message.role !== "user" && message.role !== "assistant") {
      return { ok: false, error: "One or more messages have an invalid role." }
    }
    if (typeof message.content !== "string") {
      return { ok: false, error: "One or more messages have invalid content." }
    }
    if (message.content.length > MAX_MESSAGE_CHARS) {
      return { ok: false, error: `Each message is limited to ${MAX_MESSAGE_CHARS} characters.` }
    }
    if (message.content.trim().length === 0) {
      return { ok: false, error: "Messages cannot be empty." }
    }
    totalChars += message.content.length
    if (totalChars > MAX_CHAT_CHARS) {
      return { ok: false, error: "This conversation is too long. Start a new chat." }
    }
    if (message.role === "user") hasUserMessage = true
    messages.push({ role: message.role, content: message.content })
  }
  if (!hasUserMessage) {
    return { ok: false, error: "Send at least one message from the learner." }
  }

  let threadId: string | undefined
  if (raw.threadId !== undefined && raw.threadId !== null) {
    if (typeof raw.threadId !== "string" || !UUID_RE.test(raw.threadId)) {
      return { ok: false, error: "Invalid conversation id." }
    }
    threadId = raw.threadId
  }

  let images: string[] | undefined
  if (raw.images !== undefined && raw.images !== null) {
    if (!Array.isArray(raw.images)) {
      return { ok: false, error: "Attached images are invalid." }
    }
    if (raw.images.length > MAX_TUTOR_IMAGES) {
      return { ok: false, error: `Attach up to ${MAX_TUTOR_IMAGES} images.` }
    }
    if (raw.images.some((path) => typeof path !== "string" || path.length === 0 || path.length > 512)) {
      return { ok: false, error: "One or more attached images are invalid." }
    }
    images = raw.images.length > 0 ? (raw.images as string[]) : undefined
  }

  return {
    ok: true,
    value: { messages, context: sanitizeContext(raw.context), threadId, images },
  }
}

/** Exposed for tests: the context sanitizer is also useful on its own. */
export { sanitizeContext }
