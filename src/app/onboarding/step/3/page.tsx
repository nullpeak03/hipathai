"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { OnboardingShell } from "@/components/onboarding/onboarding-shell"

const skillLevels = [
  { value: "beginner", label: "Beginner", description: "New to this topic, need fundamentals" },
  { value: "intermediate", label: "Intermediate", description: "Some experience, want to go deeper" },
  { value: "advanced", label: "Advanced", description: "Deep experience, want mastery" },
]

export default function OnboardingStep3() {
  const router = useRouter()
  const [skillLevel, setSkillLevel] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!skillLevel) return
    const prevData = JSON.parse(localStorage.getItem("onboarding-step-2") || "{}")
    const data = { ...prevData, skillLevel }
    localStorage.setItem("onboarding-step-3", JSON.stringify(data))
    router.push("/onboarding/step/4")
  }

  const handleBack = () => {
    router.push("/onboarding/step/2")
  }

  return (
    <OnboardingShell step={3} title="What&apos;s your current skill level?" subtitle="We&apos;ll adjust the difficulty and pacing accordingly">
        <form onSubmit={handleSubmit} className="space-y-8">

          <RadioGroup value={skillLevel} onValueChange={setSkillLevel} className="space-y-4">
            {skillLevels.map((level) => (
              <div key={level.value} className="relative">
                <RadioGroupItem id={`skill-${level.value}`} value={level.value} className="sr-only" />
                <label
                  htmlFor={`skill-${level.value}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:-translate-y-0.5 hover:border-[#55D6FF]/60 hover:bg-white/[0.07]",
                    skillLevel === level.value && "border-[#55D6FF] bg-[#55D6FF]/10 shadow-[0_0_24px_rgba(85,214,255,.12)]"
                  )}
                >
                  <div className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                    skillLevel === level.value ? "border-[#55D6FF] bg-[#55D6FF]" : "border-slate-600"
                  )}>
                    {skillLevel === level.value && (
                      <div className="h-2.5 w-2.5 rounded-full bg-[#080d1c]" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{level.label}</div>
                    <div className="text-sm text-slate-400">{level.description}</div>
                  </div>
                </label>
              </div>
            ))}
          </RadioGroup>

          <div className="flex items-center justify-between gap-4">
            <Button type="button" variant="ghost" onClick={handleBack} className="text-slate-400 hover:bg-white/5 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button type="submit" className="rounded-xl bg-gradient-to-r from-[#7C5CFC] to-[#55D6FF] px-6 font-semibold text-[#080d1c] hover:opacity-90" disabled={!skillLevel}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
    </OnboardingShell>
  )
}