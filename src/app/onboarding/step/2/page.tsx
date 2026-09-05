"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ArrowLeft, ArrowRight } from "lucide-react"

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
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Step 2 of 6</span>
            <span className="text-sm font-medium text-primary">33%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: "33.33%" }} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-background border rounded-xl p-6 md:p-8 shadow-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">What's your learning objective?</h1>
            <p className="text-muted-foreground">This helps us structure your roadmap effectively</p>
          </div>

          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium">
                Primary learning objective
              </Label>
              <Select
                value={learningObjective}
                onValueChange={setLearningObjective}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select your objective" />
                </SelectTrigger>
                <SelectContent>
                  {objectiveOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-4 mt-8">
            <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button type="submit" className="flex-1 gap-2" disabled={!learningObjective}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}