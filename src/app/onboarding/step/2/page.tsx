"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { OnboardingShell } from "@/components/onboarding/onboarding-shell"

const objectiveOptions = [
  { value: "master-new-technology", label: "Master a new technology/framework" },
  { value: "prepare-for-interview", label: "Prepare for technical interviews" },
  { value: "career-transition", label: "Transition to a new role" },
  { value: "deepen-expertise", label: "Deepen expertise in current field" },
  { value: "build-project", label: "Build a specific project" },
  { value: "certification", label: "Prepare for certification" },
  { value: "other", label: "Other" },
]

export default function OnboardingStep2() {
  const router = useRouter()
  const [learningObjective, setLearningObjective] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!learningObjective) return
    const prevData = JSON.parse(localStorage.getItem("onboarding-step-1") || "{}")
    const data = { ...prevData, learningObjective }
    localStorage.setItem("onboarding-step-2", JSON.stringify(data))
    router.push("/onboarding/step/3")
  }

  const handleBack = () => {
    router.push("/onboarding/step/1")
  }

  return (
    <OnboardingShell step={2} title="What&apos;s your learning objective?" subtitle="This helps us structure your roadmap effectively">
        <form onSubmit={handleSubmit} className="space-y-8">

          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium text-slate-200">
                Primary learning objective
              </Label>
              <Select
                value={learningObjective}
                onValueChange={setLearningObjective}
              >
                <SelectTrigger className="mt-3 h-14 rounded-2xl border-white/10 bg-white/[0.04] text-base text-white">
                  <SelectValue placeholder="Select your objective" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#101828] text-white">
                  {objectiveOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Button type="button" variant="ghost" onClick={handleBack} className="text-slate-400 hover:bg-white/5 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button type="submit" className="rounded-xl bg-gradient-to-r from-[#7C5CFC] to-[#55D6FF] px-6 font-semibold text-[#080d1c] hover:opacity-90" disabled={!learningObjective}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
    </OnboardingShell>
  )
}