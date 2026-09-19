"use client"
import { useState, useEffect, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter, useSearchParams } from "next/navigation"
import { saveRoadmap, loadRoadmap, type RoadmapData } from "@/lib/store"
import { motion, AnimatePresence } from "framer-motion"
import { ONBOARDING_STEPS, parseTimeToMinutes, parseDurationToDays } from "@/lib/onboarding.config"
import { friendlyGenerationError } from "@/lib/generation-errors"
import { useUser } from "@clerk/nextjs"

function OnboardingContent() {
  const { user } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")
  const isEdit = !!editId
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Record<string,string>>({
    goal: "AI Agent Developer",
    level: "Beginner",
    time: "1 hr",
    duration: "8 weeks",
    why: "Career Switch",
    style: "Hands-on",
  })
  const [customTime, setCustomTime] = useState("")
  const [customDuration, setCustomDuration] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [polling, setPolling] = useState(false)
  const [pollStatus, setPollStatus] = useState("")

  const current = ONBOARDING_STEPS[step]
  const setVal = (id: string, v: string) => setValues(prev => ({ ...prev, [id]: v }))

  // persist draft + edit mode prefill from existing roadmap
  useEffect(()=> {
    if (isEdit) {
      const existing = loadRoadmap()
      if (existing?.title) {
        const goalFromTitle = existing.title.replace(" Roadmap (2026 Edition)", "").replace(" Roadmap", "")
        if (goalFromTitle) setValues(prev=> ({...prev, goal: goalFromTitle}))
        return
      }
    }
    const saved = localStorage.getItem("hipath_onboarding_draft")
    if (saved) try { setValues(JSON.parse(saved)) } catch {}
  }, [isEdit])
  useEffect(()=> { localStorage.setItem("hipath_onboarding_draft", JSON.stringify(values)) }, [values])

  const canNext = () => {
    if (current.id === "goal") return values.goal.trim().length >= 3
    const v = values[current.id]
    if (!v) return false
    if (v === "Custom" && current.id === "time") return customTime.trim().length > 0
    if (v === "Custom" && current.id === "duration") return customDuration.trim().length > 0
    return true
  }

  const next = () => { if (canNext()) setStep(s=> Math.min(ONBOARDING_STEPS.length-1, s+1)) }
  const prev = () => setStep(s=> Math.max(0, s-1))

  const pollJob = async (jobId: string): Promise<RoadmapData> => {
    const maxAttempts = 200 // 200 * 3s = 600s (10 minutes max)
    let failures = 0
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, 3000))
      try {
        const res = await fetch(`/api/roadmaps/status/${jobId}`)
        const data = (await res.json().catch(() => ({}))) as {
          status?: string
          error?: string
          roadmap?: RoadmapData
        }
        if (res.ok && data.status === "completed" && data.roadmap) {
          return data.roadmap
        }
        // Terminal job failure — surface the friendly message immediately
        if (res.ok && data.status === "failed") {
          throw new Error(`FATAL:${friendlyGenerationError(data.error || "Generation failed")}`)
        }
        if (!res.ok) throw new Error(`Status check failed (${res.status})`)
        failures = 0
        setPollStatus(`Generating roadmap... (${Math.round((attempt / maxAttempts) * 100)}%)`)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        if (message.startsWith("FATAL:")) throw new Error(message.slice(6))
        failures += 1
        // Persistent errors (broken backend, offline) fail fast with guidance
        // instead of silently timing out 10 minutes later.
        if (failures >= 5) {
          throw new Error(friendlyGenerationError("Our servers are having trouble reaching your roadmap. Please check your connection and try again."))
        }
        // Transient blip — keep polling
      }
    }
    throw new Error(friendlyGenerationError("Generation timed out. Please try again."))
  }

  const generate = async () => {
    if (values.goal.trim().length < 3) { setError("Please enter a goal with at least 3 characters."); return }
    setLoading(true); setError(""); setPolling(true); setPollStatus("Starting generation...")
    const timeVal = values.time === "Custom" ? customTime : values.time
    const durationVal = values.duration === "Custom" ? customDuration : values.duration
    const payload = {
      goal: values.goal,
      level: values.level,
      time: timeVal,
      duration: durationVal,
      why: values.why,
      style: values.style,
      timeMins: parseTimeToMinutes(timeVal),
      durationDays: parseDurationToDays(durationVal),
      userId: user?.id || null
    }
    try {
      const res = await fetch("/api/roadmaps/async", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(()=> ({}))
      if (!res.ok) throw new Error(data.error || "Failed to start generation")
      
      setPollStatus("AI is creating your personalized roadmap...")
      const roadmap = await pollJob(data.jobId)

      // The status endpoint returns the full Supabase-saved roadmap with real
      // UUIDs — cache it directly. No second insert: Inngest already saved it,
      // so Supabase stays the single source of truth and localStorage is cache.
      saveRoadmap(roadmap)
      // Edit mode: replace the old roadmap so regenerations never duplicate
      if (isEdit && editId && editId !== roadmap.id) {
        try {
          await fetch(`/api/me/roadmaps/${editId}`, { method: "DELETE" })
        } catch {
          // old roadmap stays on the server; the new one is already cached
        }
      }
      localStorage.removeItem("hipath_progress")
      localStorage.removeItem("hipath_onboarding_draft")
      setPolling(false)
      router.push("/roadmap")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate. Please try again.")
      setPolling(false)
    } finally { setLoading(false) }
  }

  const renderOptions = (stepCfg: typeof current) => {
    if (!stepCfg.options) return null
    const val = values[stepCfg.id]
    const isTimeOrDurationCustom = (stepCfg.id === "time" || stepCfg.id === "duration") && val === "Custom"
    return (
      <div className="space-y-4">
        <div className={`grid gap-3 mt-6 ${stepCfg.options.length <=4 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
          {stepCfg.options.map(opt=> (
            <button key={opt.value} onClick={()=> setVal(stepCfg.id, opt.value)} className={`p-4 rounded-xl border text-sm font-medium text-left ${val===opt.value ? "bg-[#6C5BFF] text-white border-[#6C5BFF]" : "bg-white hover:bg-gray-50"}`}>
              <div>{opt.label}</div>
              {opt.desc && <div className={`text-xs mt-1 ${val===opt.value ? "text-white/80" : "text-zinc-500"}`}>{opt.desc}</div>}
            </button>
          ))}
        </div>
        {isTimeOrDurationCustom && (
          <Input
            autoFocus
            placeholder={stepCfg.id==="time" ? "e.g., 90 min, 3 hrs" : "e.g., 6 weeks, 3 months"}
            value={stepCfg.id==="time" ? customTime : customDuration}
            onChange={e=> stepCfg.id==="time" ? setCustomTime(e.target.value) : setCustomDuration(e.target.value)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-14 border-b bg-white flex items-center px-6 justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-[#6C5BFF] flex items-center justify-center text-white font-bold">H</div><span className="font-bold text-sm">HiPath AI</span></div>
        <span className="text-xs text-zinc-500">{isEdit ? "Editing roadmap • " : ""}Step {step+1} / {ONBOARDING_STEPS.length}: {current.title.split(" ")[0]}</span>
      </header>
      <div className="max-w-2xl mx-auto w-full p-6 mt-2">
        <div className="h-2 bg-gray-200 rounded-full mb-8"><div className="h-2 bg-[#6C5BFF] rounded-full transition-all" style={{width: `${((step+1)/ONBOARDING_STEPS.length)*100}%`}} /></div>
        <div className="bg-white rounded-2xl border p-8 shadow-sm min-h-[460px] flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{opacity:0, x:16}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-16}} transition={{duration:0.2}} className="flex-1">
              <h2 className="text-2xl font-bold">{current.title}</h2>
              <p className="text-sm text-zinc-500 mt-1">{current.subtitle}</p>
              {current.id==="goal" ? (
                <div className="mt-6 space-y-3">
                  <Input value={values.goal} onChange={e=> setVal("goal", e.target.value)} placeholder={current.placeholder} />
                  {values.goal.trim().length>0 && values.goal.trim().length<3 && <p className="text-xs text-red-500">Goal must be at least 3 characters</p>}
                  <div className="flex flex-wrap gap-2">
                    {current.options?.map(s=> <button key={s.value} onClick={()=> setVal("goal", s.value)} className="text-xs border px-3 py-1.5 rounded-full hover:bg-gray-50">{s.label}</button>)}
                  </div>
                </div>
              ) : renderOptions(current)}
              {current.id==="style" && (
                <div className="mt-6 p-4 bg-violet-50 rounded-xl text-sm">
                  <b>Summary:</b> {values.goal} • {values.level} • {values.time==="Custom"?customTime:values.time} • {values.duration==="Custom"?customDuration:values.duration} • {values.why} • {values.style}
                </div>
              )}
              {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              {!error && polling && pollStatus && <div className="mt-4 p-3 bg-violet-50 border border-violet-200 rounded-lg text-sm text-violet-700">{pollStatus}</div>}
            </motion.div>
          </AnimatePresence>
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={prev} disabled={step===0}>Back</Button>
            {step < ONBOARDING_STEPS.length-1 ? <Button onClick={next} disabled={!canNext()}>Continue</Button> : <Button onClick={generate} disabled={loading || polling || !canNext()}>{loading||polling?"Generating…":"Generate Roadmap →"}</Button>}
          </div>
          <p className="text-xs text-zinc-400 text-center mt-3">Flexible — add options in <code>onboarding.config.ts</code> without code changes</p>
        </div>
      </div>
    </div>
  )
}

export default function Onboarding() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-pulse h-8 w-48 bg-gray-200 rounded"/></div>}>
      <OnboardingContent />
    </Suspense>
  )
}
