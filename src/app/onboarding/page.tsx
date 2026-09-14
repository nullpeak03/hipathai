"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { generateMockRoadmap } from "@/lib/mockData"
import { saveRoadmap } from "@/lib/store"
import { motion, AnimatePresence } from "framer-motion"

const steps = ["Goal","Level","Time","Duration","Why","Style"] as const

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState("AI Agent Developer")
  const [level, setLevel] = useState("Beginner")
  const [time, setTime] = useState("1 hr / day")
  const [duration, setDuration] = useState("8 weeks")
  const [why, setWhy] = useState("Career Switch")
  const [style, setStyle] = useState("Hands-on")
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const next = () => setStep(s=> Math.min(steps.length-1, s+1))
  const prev = () => setStep(s=> Math.max(0, s-1))

  const generate = async () => {
    setLoading(true)
    // simulate Inngest + NIMs fallback (instant with mock, real would be async)
    // If NIM key present, we would call /api/roadmaps — here use mock
    const roadmap = generateMockRoadmap(goal)
    saveRoadmap(roadmap)
    // also clear progress
    localStorage.removeItem("hipath_progress")
    setTimeout(()=> router.push("/dashboard"), 800)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col">
      <header className="h-14 border-b bg-white dark:bg-zinc-900 dark:border-zinc-800 flex items-center px-6 justify-between">
        <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-[#6C5BFF] flex items-center justify-center text-white font-bold">H</div><span className="font-bold text-sm">HiPath AI</span></div>
        <span className="text-xs text-zinc-500">Step {step+1} / {steps.length}: {steps[step]}</span>
      </header>
      <div className="max-w-2xl mx-auto w-full p-6 mt-6">
        <div className="h-2 bg-gray-200 dark:bg-zinc-800 rounded-full mb-8"><div className="h-2 bg-[#6C5BFF] rounded-full transition-all" style={{width: `${((step+1)/steps.length)*100}%`}} /></div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border dark:border-zinc-800 p-8 shadow-sm min-h-[420px] flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="flex-1">
              {step===0 && <><h2 className="text-2xl font-bold">What do you want to learn?</h2><p className="text-sm text-zinc-500 mt-1">Turn any goal into a structured roadmap.</p><Input value={goal} onChange={e=>setGoal(e.target.value)} placeholder="e.g., Become AI Agent developer with Python" className="mt-6" /><div className="flex flex-wrap gap-2 mt-3">{["AI Agent Developer","Full Stack Web Dev","Data Structures & Algorithms","Machine Learning"].map(s=> <button key={s} onClick={()=>setGoal(s)} className="text-xs border px-3 py-1.5 rounded-full hover:bg-gray-50 dark:hover:bg-zinc-800">{s}</button>)}</div></>}
              {step===1 && <><h2 className="text-2xl font-bold">Your level?</h2><div className="grid grid-cols-3 gap-3 mt-6">{["Beginner","Intermediate","Advanced"].map(l=> <button key={l} onClick={()=>setLevel(l)} className={`p-4 rounded-xl border text-sm font-medium ${level===l?"bg-[#6C5BFF] text-white border-[#6C5BFF]":"bg-white dark:bg-zinc-900"}`}>{l}</button>)}</div></>}
              {step===2 && <><h2 className="text-2xl font-bold">Time per day?</h2><div className="grid grid-cols-2 gap-3 mt-6">{["30 min","1 hr / day","2 hrs / day","Custom"].map(t=> <button key={t} onClick={()=>setTime(t)} className={`p-4 rounded-xl border text-sm font-medium ${time===t?"bg-[#6C5BFF] text-white":"bg-white dark:bg-zinc-900"}`}>{t}</button>)}</div></>}
              {step===3 && <><h2 className="text-2xl font-bold">Duration?</h2><div className="grid grid-cols-2 gap-3 mt-6">{["2 weeks","4 weeks","8 weeks","12 weeks"].map(d=> <button key={d} onClick={()=>setDuration(d)} className={`p-4 rounded-xl border text-sm font-medium ${duration===d?"bg-[#6C5BFF] text-white":"bg-white dark:bg-zinc-900"}`}>{d}</button>)}</div></>}
              {step===4 && <><h2 className="text-2xl font-bold">Why are you learning?</h2><div className="grid grid-cols-2 gap-3 mt-6">{["Career Switch","Upskilling","Exam Prep","Build Project"].map(w=> <button key={w} onClick={()=>setWhy(w)} className={`p-4 rounded-xl border text-sm font-medium ${why===w?"bg-[#6C5BFF] text-white":"bg-white dark:bg-zinc-900"}`}>{w}</button>)}</div></>}
              {step===5 && <><h2 className="text-2xl font-bold">Preferred style?</h2><div className="grid grid-cols-3 gap-3 mt-6">{["Visual","Hands-on","Theory"].map(s=> <button key={s} onClick={()=>setStyle(s)} className={`p-4 rounded-xl border text-sm font-medium ${style===s?"bg-[#6C5BFF] text-white":"bg-white dark:bg-zinc-900"}`}>{s}</button>)}</div><div className="mt-6 p-4 bg-violet-50 dark:bg-violet-950 rounded-xl text-sm"><b>Summary:</b> {goal} • {level} • {time} • {duration} • {why} • {style}</div></>}
            </motion.div>
          </AnimatePresence>
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={prev} disabled={step===0}>Back</Button>
            {step < steps.length-1 ? <Button onClick={next}>Continue</Button> : <Button onClick={generate} disabled={loading}>{loading?"Generating...":"Generate Roadmap →"}</Button>}
          </div>
        </div>
      </div>
    </div>
  )
}
