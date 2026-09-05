"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ArrowRight } from "lucide-react"

const roleOptions = [
  { value: "software-engineer", label: "Software Engineer" },
  { value: "data-scientist", label: "Data Scientist" },
  { value: "designer", label: "Designer" },
  { value: "product-manager", label: "Product Manager" },
  { value: "student", label: "Student" },
  { value: "career-changer", label: "Career Changer" },
  { value: "other", label: "Other" },
]

export default function OnboardingStep1() {
  const router = useRouter()
  const [currentRole, setCurrentRole] = useState("")
  const [careerGoal, setCareerGoal] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentRole || !careerGoal.trim()) return
    const data = { currentRole, careerGoal }
    localStorage.setItem("onboarding-step-1", JSON.stringify(data))
    router.push("/onboarding/step/2")
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Step 1 of 6</span>
            <span className="text-sm font-medium text-primary">17%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: "16.66%" }} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-background border rounded-xl p-6 md:p-8 shadow-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Tell us about yourself</h1>
            <p className="text-muted-foreground">We'll use this to personalize your learning path</p>
          </div>

          <div className="space-y-6">
            <div>
              <Label htmlFor="currentRole" className="text-base font-medium">
                What's your current role?
              </Label>
              <Select
                value={currentRole}
                onValueChange={setCurrentRole}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="careerGoal" className="text-base font-medium">
                What's your career goal?
              </Label>
              <input
                id="careerGoal"
                type="text"
                value={careerGoal}
                onChange={(e) => setCareerGoal(e.target.value)}
                placeholder="e.g., Become a Senior Full-Stack Engineer"
                className={cn(
                  "mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                )}
                maxLength={200}
                required
              />
              <p className="text-sm text-muted-foreground mt-1">
                Be specific — this helps us tailor your roadmap
              </p>
            </div>
          </div>

          <Button type="submit" className="w-full mt-8 gap-2" disabled={!currentRole || !careerGoal.trim()}>
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}