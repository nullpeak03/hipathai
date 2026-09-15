"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { saveRoadmap } from "@/lib/store"
import { motion, AnimatePresence } from "framer-motion"
import { ONBOARDING_STEPS, parseTimeToMinutes, parseDurationToDays } from "@/lib/onboarding.config"
import { useUser } from "@clerk/nextjs"

export default function Onboarding() {
  const { user } = useUser() as any
  const router = useRouter()
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

  const current = ONBOARDING_STEPS[step]
  const setVal = (id: string, v: string) => setValues(prev => ({ ...prev, [id]: v }))

  // persist draft
  useEffect(()=> {
    const saved = localStorage.getItem("hipath_onboarding_draft")
    if (saved) try { setValues(JSON.parse(saved)) } catch {}
  }, [])
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

  const generate = async () => {
    if (values.goal.trim().length < 3) { setError("Please enter a goal with at least 3 characters."); return }
    setLoading(true); setError("")
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
    }
    try {
      const res = await fetch("/api/roadmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(()=> ({}))
      if (!res.ok) throw new Error(data.error || data.message || "Failed to generate roadmap")
      // data may be {title, description, phases} from NIMs or mock
      // Normalize to store format
      if (data.title && data.phases) {
        const normalized = {
          id: data.id || `roadmap-${Date.now()}`,
          title: data.title,
          description: data.description || `Personalized roadmap for ${payload.goal}`,
          phases: data.phases.map((p:any, pi:number)=> ({
            id: p.id || `p${pi+1}`,
            idx: pi+1,
            title: p.title,
            lessons: (p.lessons || []).map((l:any, li:number)=> ({
              id: l.id || `p${pi+1}-l${li+1}`,
              idx: li+1,
              phaseIdx: pi+1,
              title: l.title,
              contentMd: l.objective ? `## ${l.title}\n\n${l.objective}` : `## ${l.title}\n\nLearn ${l.title} with AI guidance.`,
              exampleCode: l.exampleCode || `// Example for ${l.title}`,
              quiz: l.quiz || [{ q: `What is ${l.title}?`, options: ["Option A","Option B","Option C","Option D"], correct: 0, explanation: "Review the lesson." }],
              isLocked: !(pi===0 && li===0),
              isCompleted: false
            }))
          })),
          totalLessons: data.phases.reduce((a:number,p:any)=> a + (p.lessons?.length||0), 0)
        }
        saveRoadmap(normalized as any)
        // try Supabase sync if user logged in
        if (user?.id) {
          try {
            const { supabaseSaveRoadmap } = await import("@/lib/store")
            await (supabaseSaveRoadmap as any)(user.id, normalized as any)
          } catch {}
        }
        localStorage.removeItem("hipath_progress")
        localStorage.removeItem("hipath_onboarding_draft")
        router.push("/roadmap")
      } else if (data.mock) {
        throw new Error("AI not configured — try again later")
      } else {
        throw new Error("Unexpected response")
      }
    } catch (e:any) {
      setError(e.message || "Failed to generate. Please try again.")
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
        <span className="text-xs text-zinc-500">Step {step+1} / {ONBOARDING_STEPS.length}: {current.title.split(" ")[0]}</span>
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
            </motion.div>
          </AnimatePresence>
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={prev} disabled={step===0}>Back</Button>
            {step < ONBOARDING_STEPS.length-1 ? <Button onClick={next} disabled={!canNext()}>Continue</Button> : <Button onClick={generate} disabled={loading || !canNext()}>{loading?"Generating…":"Generate Roadmap →"}</Button>}
          </div>
          <p className="text-xs text-zinc-400 text-center mt-3">Flexible — add options in <code>onboarding.config.ts</code> without code changes</p>
        </div>
      </div>
    </div>
  )
}
