"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { ArrowLeft, ArrowRight, Video, FileText, Code, LayoutGrid } from "lucide-react"

const formatOptions = [
  {
    value: "video",
    label: "Video-based",
    description: "Prefer watching tutorials and lectures",
    icon: Video,
  },
  {
    value: "text",
    label: "Text/Reading",
    description: "Learn best through articles and documentation",
    icon: FileText,
  },
  {
    value: "interactive",
    label: "Hands-on/Interactive",
    description: "Need to code and build to understand",
    icon: Code,
  },
  {
    value: "mixed",
    label: "Mixed (Recommended)",
    description: "Balanced approach with all formats",
    icon: LayoutGrid,
  },
]

export default function OnboardingStep5() {
  const router = useRouter()
  const [contentFormat, setContentFormat] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!contentFormat) return
    const prevData = JSON.parse(localStorage.getItem("onboarding-step-4") || "{}")
    const data = { ...prevData, contentFormat }
    localStorage.setItem("onboarding-step-5", JSON.stringify(data))
    router.push("/onboarding/step/6")
  }

  const handleBack = () => {
    router.push("/onboarding/step/4")
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Step 5 of 6</span>
            <span className="text-sm font-medium text-primary">83%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: "83.33%" }} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-background border rounded-xl p-6 md:p-8 shadow-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Preferred content format?</h1>
            <p className="text-muted-foreground">We'll adapt lessons to your learning style</p>
          </div>

          <RadioGroup value={contentFormat} onValueChange={setContentFormat} className="space-y-4">
            {formatOptions.map((option) => {
              const Icon = option.icon
              return (
                <div key={option.value} className="relative">
                  <RadioGroupItem value={option.value} className="sr-only" />
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-all hover:border-primary/50",
                      contentFormat === option.value && "border-primary bg-primary/5"
                    )}
                  >
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center transition-all",
                      contentFormat === option.value ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-muted-foreground">{option.description}</div>
                    </div>
                  </label>
                </div>
              )
            })}
          </RadioGroup>

          <div className="flex gap-4 mt-8">
            <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button type="submit" className="flex-1 gap-2" disabled={!contentFormat}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}