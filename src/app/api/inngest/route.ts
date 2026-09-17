import { serve } from "inngest/next"
import { inngest } from "@/lib/inngest/client"
import { generateRoadmapFn } from "@/lib/inngest/functions"

console.log("[inngest] Webhook handler initialized, signing key present:", !!process.env.INNGEST_SIGNING_KEY)

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateRoadmapFn],
  onFailure: async (err) => {
    console.error("[inngest] Webhook error:", err)
  }
})
