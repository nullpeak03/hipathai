"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { ArrowLeft, ArrowRight, Clock } from "lucide-react"

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
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Step 4 of 6</span>
            <span className="text-sm font-medium text-primary">67%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: "66.66%" }} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-background border rounded-xl p-6 md:p-8 shadow-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">How many hours per week?</h1>
            <p className="text-muted-foreground">We'll pace your roadmap to fit your schedule</p>
          </div>

          <div className="space-y-8">
            <div>
              <Label className="text-base font-medium">
                Weekly learning time
              </Label>
              <div className="flex items-center justify-between mt-4 mb-2">
                <span className="text-3xl font-bold text-primary">{hoursPerWeek} hours</span>
                <span className="text-muted-foreground">per week</span>
              </div>
              <Slider
                value={[hoursPerWeek]}
                onValueChange={([value]) => setHoursPerWeek(value)}
                max={20}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>1 hour</span>
                <span>20 hours</span>
              </div>
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    Estimated completion: ~{" "}
                    <span className="font-medium text-foreground">
                      {Math.ceil(80 / hoursPerWeek)} weeks
                    </span>
                    {" (assuming ~80 hours total)"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-8">
            <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button type="submit" className="flex-1 gap-2">
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}