"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ArrowLeft, ArrowRight, Clock } from "lucide-react"
import { OnboardingShell } from "@/components/onboarding/onboarding-shell"

const dailyOptions = [15, 30, 45, 60, 90, 120]

export default function OnboardingStep4() {
  const router = useRouter()
  const [dailyMinutes, setDailyMinutes] = useState(30)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (dailyMinutes < 5 || dailyMinutes > 480) return
    const prevData = JSON.parse(localStorage.getItem("onboarding-step-3") || "{}")
    const weeklyHours = (dailyMinutes * 7) / 60
    const hoursPerWeek = weeklyHours <= 3 ? "light" : weeklyHours <= 7 ? "moderate" : "intensive"
    const data = { ...prevData, dailyMinutes, hoursPerWeek }
    localStorage.setItem("onboarding-step-4", JSON.stringify(data))
    router.push("/onboarding/step/5")
  }

  const handleBack = () => {
    router.push("/onboarding/step/3")
  }

  return (
    <OnboardingShell step={4} title="How much time can you give each day?" subtitle="Your daily rhythm helps us build a plan you can actually sustain">
        <form onSubmit={handleSubmit} className="space-y-8">

          <div className="space-y-8">
            <div>
              <Label className="text-base font-medium text-slate-200">
                Daily learning time
              </Label>
              <div className="flex items-center justify-between mt-4 mb-2">
                <span className="text-4xl font-semibold text-[#55D6FF]">
                  {dailyMinutes >= 60 ? `${Math.floor(dailyMinutes / 60)}h ${dailyMinutes % 60 ? `${dailyMinutes % 60}m` : ""}` : `${dailyMinutes}m`}
                </span>
                <span className="text-slate-400">per day</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {dailyOptions.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setDailyMinutes(minutes)}
                    className={cn(
                      "rounded-xl border px-2 py-3 text-sm transition",
                      dailyMinutes === minutes
                        ? "border-[#55D6FF] bg-[#55D6FF]/10 text-[#55D6FF]"
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/30 hover:text-white"
                    )}
                  >
                    {minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}
                  </button>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-3">
                <Input
                  type="number"
                  min={5}
                  max={480}
                  value={dailyMinutes}
                  onChange={(event) => setDailyMinutes(Number(event.target.value))}
                  className="h-12 w-28 rounded-xl border-white/10 bg-white/[0.04] text-white"
                  aria-label="Custom daily minutes"
                />
                <span className="text-sm text-slate-400">minutes daily (custom)</span>
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Clock className="h-4 w-4" />
                  <span>
                    That&apos;s about{" "}
                    <span                     className="font-medium text-white">
                      {Math.round((dailyMinutes * 7) / 60 * 10) / 10} hours per week
                    </span>
                    {" — we'll keep sessions focused and realistic."}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Button type="button" variant="ghost" onClick={handleBack} className="text-slate-400 hover:bg-white/5 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button type="submit" disabled={dailyMinutes < 5 || dailyMinutes > 480} className="rounded-xl bg-gradient-to-r from-[#7C5CFC] to-[#55D6FF] px-6 font-semibold text-[#080d1c] hover:opacity-90">
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
    </OnboardingShell>
  )
}