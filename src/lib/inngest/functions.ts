import { inngest } from "./client"
import { chatWithFallback } from "@/lib/nvidia"

export const generateRoadmapFn = inngest.createFunction(
  { id: "generate-roadmap", trigger: { event: "roadmap/generate" } } as any,
  async ({ event, step }: any) => {
    const { goal, level, time, duration } = event.data
    const prompt = `Generate roadmap JSON for "${goal}" level ${level} time ${time} duration ${duration}. JSON: {title, description, phases:[{title, lessons:[{title}]}]}`
    const { content, modelUsed } = await step.run("nvidia-fallback", async () => {
      return await chatWithFallback([{ role:"user", content: prompt }], true)
    })
    // In production, write to Supabase here and publish realtime
    return { modelUsed, content: JSON.parse(content) }
  }
)
