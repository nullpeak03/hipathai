"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ArrowRight } from "lucide-react"
import { OnboardingShell } from "@/components/onboarding/onboarding-shell"

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
    <OnboardingShell step={1} title="Tell us about yourself" subtitle="We&apos;ll use this to personalize your learning path">
        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="space-y-6">
            <div>
              <Label htmlFor="currentRole" className="text-base font-medium text-slate-200">
                What's your current role?
              </Label>
              <Select
                value={currentRole}
                onValueChange={setCurrentRole}
              >
                <SelectTrigger className="mt-3 h-14 rounded-2xl border-white/10 bg-white/[0.04] text-base text-white">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#101828] text-white">
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="careerGoal" className="text-base font-medium text-slate-200">
                What's your career goal?
              </Label>
              <input
                id="careerGoal"
                type="text"
                value={careerGoal}
                onChange={(e) => setCareerGoal(e.target.value)}
                placeholder="e.g., Become a Senior Full-Stack Engineer"
                className={cn(
                  "mt-3 flex h-14 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55D6FF] disabled:cursor-not-allowed disabled:opacity-50"
                )}
                maxLength={200}
                required
              />
              <p className="mt-2 text-sm text-slate-500">
                Be specific — this helps us tailor your roadmap
              </p>
            </div>
          </div>

          <Button type="submit" className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#7C5CFC] to-[#55D6FF] py-6 font-semibold text-[#080d1c] hover:opacity-90" disabled={!currentRole || !careerGoal.trim()}>
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
    </OnboardingShell>
  )
}