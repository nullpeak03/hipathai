"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { ArrowLeft, ArrowRight, Clock } from "lucide-react"
import { OnboardingShell } from "@/components/onboarding/onboarding-shell"

export default function OnboardingStep4() {
  const router = useRouter()
  const [hoursPerWeek, setHoursPerWeek] = useState(5)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const prevData = JSON.parse(localStorage.getItem("onboarding-step-3") || "{}")
    const data = { ...prevData, hoursPerWeek }
    localStorage.setItem("onboarding-step-4", JSON.stringify(data))
    router.push("/onboarding/step/5")
  }

  const handleBack = () => {
    router.push("/onboarding/step/3")
  }

  return (
    <OnboardingShell step={4} title="How many hours per week?" subtitle="We&apos;ll pace your roadmap to fit your schedule">
        <form onSubmit={handleSubmit} className="space-y-8">

          <div className="space-y-8">
            <div>
              <Label className="text-base font-medium text-slate-200">
                Weekly learning time
              </Label>
              <div className="flex items-center justify-between mt-4 mb-2">
                <span className="text-4xl font-semibold text-[#55D6FF]">{hoursPerWeek} hours</span>
                <span className="text-slate-400">per week</span>
              </div>
              <Slider
                value={[hoursPerWeek]}
                onValueChange={([value]) => setHoursPerWeek(value)}
                max={20}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="mt-2 flex justify-between text-sm text-slate-500">
                <span>1 hour</span>
                <span>20 hours</span>
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Clock className="h-4 w-4" />
                  <span>
                    Estimated completion: ~{" "}
                    <span                     className="font-medium text-white">
                      {Math.ceil(80 / hoursPerWeek)} weeks
                    </span>
                    {" (assuming ~80 hours total)"}
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
            <Button type="submit" className="rounded-xl bg-gradient-to-r from-[#7C5CFC] to-[#55D6FF] px-6 font-semibold text-[#080d1c] hover:opacity-90">
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
    </OnboardingShell>
  )
}