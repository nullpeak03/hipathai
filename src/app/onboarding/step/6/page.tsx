"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { ArrowLeft, Loader2, Sparkles } from "lucide-react"
import { OnboardingShell } from "@/components/onboarding/onboarding-shell"

const topicCategories = {
  "Frontend": [
    "React", "Vue", "Svelte", "Next.js", "TypeScript", "Tailwind CSS",
    "State Management", "Testing", "Performance", "Accessibility"
  ],
  "Backend": [
    "Node.js", "Python", "Go", "Rust", "PostgreSQL", "MongoDB",
    "Redis", "GraphQL", "REST APIs", "Microservices", "Docker", "Kubernetes"
  ],
  "Data & AI": [
    "Machine Learning", "Deep Learning", "Data Analysis", "Pandas",
    "PyTorch", "TensorFlow", "LLMs", "RAG", "Vector Databases",
    "Prompt Engineering", "MLOps"
  ],
  "DevOps & Cloud": [
    "AWS", "GCP", "Azure", "Terraform", "CI/CD", "GitHub Actions",
    "Monitoring", "Serverless", "Edge Computing"
  ],
  "Mobile": [
    "React Native", "Flutter", "Swift", "Kotlin", "Expo"
  ],
  "Other": [
    "System Design", "Algorithms", "Security", "Blockchain",
    "Web3", "Game Development", "AR/VR"
  ],
}

export default function OnboardingStep6() {
  const router = useRouter()
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [customTopic, setCustomTopic] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const prevData = JSON.parse(localStorage.getItem("onboarding-step-5") || "{}")
    if (prevData.topicsOfInterest) {
      setSelectedTopics(prevData.topicsOfInterest)
    }
  }, [])

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    )
  }

  const addCustomTopic = () => {
    if (customTopic.trim() && !selectedTopics.includes(customTopic.trim())) {
      setSelectedTopics((prev) => [...prev, customTopic.trim()])
      setCustomTopic("")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedTopics.length === 0) return

    setIsGenerating(true)
    setError("")
    const prevData = JSON.parse(localStorage.getItem("onboarding-step-5") || "{}")
    const fullData = {
      ...prevData,
      topicsOfInterest: selectedTopics,
    }

    // Save all onboarding data
    localStorage.setItem("onboarding-complete", JSON.stringify(fullData))

    // Call API to generate roadmap
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullData),
      })

      const result = await response.json()
      if (response.ok && result.roadmapId) {
        // Clear onboarding data
        for (let i = 1; i <= 6; i++) {
          localStorage.removeItem(`onboarding-step-${i}`)
        }
        localStorage.removeItem("onboarding-complete")
        router.push(`/dashboard/roadmaps/${result.roadmapId}`)
      } else {
        throw new Error(result.error || "Failed to generate roadmap")
      }
    } catch (error) {
      console.error("Roadmap generation failed:", error)
      setError(error instanceof Error ? error.message : "We couldn't create your roadmap. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleBack = () => {
    router.push("/onboarding/step/5")
  }

  const allTopics = Object.values(topicCategories).flat()

  return (
    <OnboardingShell step={6} title="What do you want to master?" subtitle="Select the topics we should prioritize in your roadmap">
        <form onSubmit={handleSubmit} className="space-y-7">
          {error && (
            <div role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}
          {/* Custom topic input */}
          <div className="mb-6">
            <Label className="mb-2 block text-base font-medium text-slate-200">Add custom topic</Label>
            <div className="flex gap-2">
              <Input
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomTopic())}
                placeholder="e.g., GraphQL Subscriptions"
                className="h-12 flex-1 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500"
              />
              <Button type="button" variant="outline" onClick={addCustomTopic} disabled={!customTopic.trim()} className="h-12 rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10">
                Add
              </Button>
            </div>
          </div>

          {/* Predefined topics by category */}
          <div className="max-h-80 space-y-6 overflow-y-auto pr-2">
            {Object.entries(topicCategories).map(([category, topics]) => (
              <div key={category} className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#55D6FF]">
                  {category}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {topics.map((topic) => (
                    <label
                      key={topic}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all hover:border-[#55D6FF]/60",
                        selectedTopics.includes(topic)
                          ? "border-[#55D6FF] bg-[#55D6FF]/10 text-[#55D6FF]"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]"
                      )}
                    >
                      <Checkbox
                        checked={selectedTopics.includes(topic)}
                        onCheckedChange={() => toggleTopic(topic)}
                        className="h-4 w-4"
                      />
                      <span>{topic}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Selected topics summary */}
          {selectedTopics.length > 0 && (
            <div className="mt-6 rounded-2xl border border-[#55D6FF]/20 bg-[#55D6FF]/10 p-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Sparkles className="h-4 w-4 text-[#55D6FF]" />
                <span>Selected ({selectedTopics.length}):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedTopics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full bg-[#55D6FF]/15 px-2 py-1 text-xs text-[#55D6FF]"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <Button type="button" variant="ghost" onClick={handleBack} className="text-slate-400 hover:bg-white/5 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button type="submit" className="rounded-xl bg-gradient-to-r from-[#7C5CFC] to-[#55D6FF] px-5 font-semibold text-[#080d1c] hover:opacity-90" disabled={selectedTopics.length === 0 || isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating your roadmap...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Roadmap
                </>
              )}
            </Button>
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">
            This may take 15-30 seconds. We're creating a complete personalized roadmap with phases,
            modules, lessons, and quizzes.
          </p>
        </form>
    </OnboardingShell>
  )
}