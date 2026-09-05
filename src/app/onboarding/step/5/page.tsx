"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { ArrowLeft, ArrowRight, Video, FileText, Code, LayoutGrid } from "lucide-react"
import { OnboardingShell } from "@/components/onboarding/onboarding-shell"

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
    const data = { ...prevData, contentFormat: [contentFormat] }
    localStorage.setItem("onboarding-step-5", JSON.stringify(data))
    router.push("/onboarding/step/6")
  }

  const handleBack = () => {
    router.push("/onboarding/step/4")
  }

  return (
    <OnboardingShell step={5} title="Preferred content format?" subtitle="We&apos;ll adapt lessons to your learning style">
        <form onSubmit={handleSubmit} className="space-y-8">

          <RadioGroup value={contentFormat} onValueChange={setContentFormat} className="space-y-4">
            {formatOptions.map((option) => {
              const Icon = option.icon
              return (
                <div key={option.value} className="relative">
                  <RadioGroupItem id={`format-${option.value}`} value={option.value} className="sr-only" />
                  <label
                    htmlFor={`format-${option.value}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:-translate-y-0.5 hover:border-[#55D6FF]/60 hover:bg-white/[0.07]",
                      contentFormat === option.value && "border-[#55D6FF] bg-[#55D6FF]/10"
                    )}
                  >
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center transition-all",
                      contentFormat === option.value ? "bg-[#55D6FF] text-[#080d1c]" : "bg-white/10 text-slate-300"
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-slate-400">{option.description}</div>
                    </div>
                  </label>
                </div>
              )
            })}
          </RadioGroup>

          <div className="flex items-center justify-between gap-4">
            <Button type="button" variant="ghost" onClick={handleBack} className="text-slate-400 hover:bg-white/5 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button type="submit" className="rounded-xl bg-gradient-to-r from-[#7C5CFC] to-[#55D6FF] px-6 font-semibold text-[#080d1c] hover:opacity-90" disabled={!contentFormat}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
    </OnboardingShell>
  )
}