"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { ArrowLeft, ArrowRight } from "lucide-react"

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
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Step 3 of 6</span>
            <span className="text-sm font-medium text-primary">50%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: "50%" }} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-background border rounded-xl p-6 md:p-8 shadow-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">What's your current skill level?</h1>
            <p className="text-muted-foreground">We'll adjust the difficulty and pacing accordingly</p>
          </div>

          <RadioGroup value={skillLevel} onValueChange={setSkillLevel} className="space-y-4">
            {skillLevels.map((level) => (
              <div key={level.value} className="relative">
                <RadioGroupItem value={level.value} className="sr-only" />
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-all hover:border-primary/50",
                    skillLevel === level.value && "border-primary bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                    skillLevel === level.value ? "border-primary bg-primary" : "border-input"
                  )}>
                    {skillLevel === level.value && (
                      <div className="h-2.5 w-2.5 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{level.label}</div>
                    <div className="text-sm text-muted-foreground">{level.description}</div>
                  </div>
                </label>
              </div>
            ))}
          </RadioGroup>

          <div className="flex gap-4 mt-8">
            <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button type="submit" className="flex-1 gap-2" disabled={!skillLevel}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}