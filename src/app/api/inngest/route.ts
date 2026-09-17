import { serve } from "inngest/next"
import { inngest } from "@/lib/inngest/client"
import { generateRoadmapFn } from "@/lib/inngest/functions"
import { NextRequest } from "next/server"

console.log("[inngest] Webhook handler initialized, signing key present:", !!process.env.INNGEST_SIGNING_KEY)

const handler = serve({
  client: inngest,
  functions: [generateRoadmapFn],
})

// Next.js App Router handlers expect (req, { params }) but Inngest handlers just need req
// We'll pass undefined for the context parameter
export async function POST(req: NextRequest) {
  return handler.POST(req, undefined as any)
}

export async function GET(req: NextRequest) {
  return handler.GET(req, undefined as any)
}

export async function PUT(req: NextRequest) {
  return handler.PUT(req, undefined as any)
}