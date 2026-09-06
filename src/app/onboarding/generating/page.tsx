"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Sparkles } from "lucide-react"
import { Logo } from "@/components/brand/logo"

const stages = [
  "Reading your goals and experience",
  "Designing your learning route",
  "Adding lessons and practice checkpoints",
  "Preparing your adaptive roadmap",
]

export default function GeneratingRoadmapPage() {
  const router = useRouter()
  const [stage, setStage] = useState(0)
  const [error, setError] = useState("")

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStage((current) => Math.min(current + 1, stages.length - 1))
    }, 2200)

    const generate = async () => {
      const raw = localStorage.getItem("onboarding-complete")
      if (!raw) {
        router.replace("/onboarding/step/1")
        return
      }

      try {
        const data = JSON.parse(raw)
        const response = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        const contentType = response.headers.get("content-type") || ""
        if (!contentType.includes("application/json")) {
          throw new Error(
            response.status === 401 || response.status === 404
              ? "Please sign in before generating your personalized roadmap."
              : "The roadmap service returned an invalid response. Please try again."
          )
        }

        const result = await response.json()
        if (!response.ok || !result.roadmapId) {
          throw new Error(result.error || "Failed to generate roadmap")
        }

        for (let index = 1; index <= 6; index++) {
          localStorage.removeItem(`onboarding-step-${index}`)
        }
        localStorage.removeItem("onboarding-complete")
        router.replace(`/dashboard/roadmaps/${result.roadmapId}`)
      } catch (generationError) {
        console.error("Roadmap generation failed:", generationError)
        const errorMsg = generationError instanceof Error ? generationError.message : "We couldn't create your roadmap."
        
        // Show specific messages based on error type
        if (errorMsg.includes("NIM API error")) {
          setError("AI service is taking a little more time to generate your roadmap. This usually resolves within a minute. Please try again if it fails.")
        } else if (errorMsg.includes("No content returned from NIM")) {
          setError("The AI service had trouble generating content. Please try again in a moment.")
        } else {
          setError(errorMsg)
        }
        window.clearInterval(timer)
      }
    }

    void generate()
    return () => window.clearInterval(timer)
  }, [router])

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080d1c] px-5 text-white">
      <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-[#7C5CFC]/25 blur-3xl" />
      <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-[#55D6FF]/15 blur-3xl" />
      <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-12">
        <Logo href="/onboarding/step/1" className="mb-12 text-white" />
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7C5CFC] to-[#55D6FF] text-[#080d1c] shadow-[0_0_35px_rgba(85,214,255,.25)]">
          <Sparkles className="h-7 w-7" />
        </div>
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#55D6FF]">HiPath AI is working</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">Building your roadmap.</h1>
        <p className="mt-4 leading-7 text-slate-400">We&apos;re turning your goals, pace, skill level, and topics into a practical route you can follow.</p>

        {error ? (
          <div className="mt-8 space-y-4">
            <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>
            <button onClick={() => router.replace("/onboarding/step/6")} className="rounded-xl bg-white px-5 py-3 font-semibold text-[#080d1c]">Back to onboarding</button>
          </div>
        ) : (
          <div className="mt-10 space-y-4">
            {stages.map((label, index) => (
              <div key={label} className={`flex items-center gap-3 rounded-xl border p-3 transition ${index <= stage ? "border-[#55D6FF]/30 bg-[#55D6FF]/10 text-white" : "border-white/5 text-slate-500"}`}>
                {index < stage ? <Check className="h-4 w-4 text-[#55D6FF]" /> : index === stage ? <Loader2 className="h-4 w-4 animate-spin text-[#55D6FF]" /> : <span className="h-4 w-4 rounded-full border border-current" />}
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
