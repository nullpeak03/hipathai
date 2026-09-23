import { serve } from "inngest/next"
import { inngest } from "@/lib/inngest/client"
import { generateRoadmapFn } from "@/lib/inngest/functions"
import { generateLessonFn } from "@/lib/inngest/lessons"
import { generateQuizFn } from "@/lib/inngest/quiz"
import { streakReminderFn } from "@/lib/inngest/reminders"
import { NextRequest } from "next/server"

console.log("[inngest] Webhook handler initialized, signing key present:", !!process.env.INNGEST_SIGNING_KEY)
console.log("[inngest] Registered functions:", generateRoadmapFn.id, generateLessonFn.id, generateQuizFn.id, streakReminderFn.id)

// Create handler once at module level
const handler = serve({
  client: inngest,
  functions: [generateRoadmapFn, generateLessonFn, generateQuizFn, streakReminderFn],
})

async function loggingHandler(req: NextRequest) {
  const headers: Record<string, string> = {}
  req.headers.forEach((value, key) => {
    headers[key] = value
  })
  console.log("[inngest] Incoming request:", req.method, req.url)
  console.log("[inngest] Headers:", JSON.stringify(headers, null, 2))
  
  try {
    const result = await handler.POST(req, undefined)
    console.log("[inngest] Handler result status:", result.status)
    return result
  } catch (err) {
    console.error("[inngest] Handler error:", err)
    throw err
  }
}

export async function POST(req: NextRequest) {
  return loggingHandler(req)
}

export async function GET(req: NextRequest) {
  return handler.GET(req, undefined)
}

export async function PUT(req: NextRequest) {
  return handler.PUT(req, undefined)
}