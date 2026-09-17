import { serve } from "inngest/next"
import { inngest } from "@/lib/inngest/client"
import { generateRoadmapFn } from "@/lib/inngest/functions"
import { NextRequest, NextResponse } from "next/server"

console.log("[inngest] Webhook handler initialized, signing key present:", !!process.env.INNGEST_SIGNING_KEY)

// Custom handler that logs all headers before passing to Inngest
async function loggingHandler(req: NextRequest) {
  const headers: Record<string, string> = {}
  req.headers.forEach((value, key) => {
    headers[key] = value
  })
  console.log("[inngest] Incoming request headers:", JSON.stringify(headers, null, 2))
  
  const handler = serve({
    client: inngest,
    functions: [generateRoadmapFn],
  })
  
  return handler.POST(req, undefined as any)
}

export async function POST(req: NextRequest) {
  return loggingHandler(req)
}

export async function GET(req: NextRequest) {
  const handler = serve({
    client: inngest,
    functions: [generateRoadmapFn],
  })
  return handler.GET(req, undefined as any)
}

export async function PUT(req: NextRequest) {
  const handler = serve({
    client: inngest,
    functions: [generateRoadmapFn],
  })
  return handler.PUT(req, undefined as any)
}