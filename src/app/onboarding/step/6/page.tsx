"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { ArrowLeft, Loader2, Sparkles } from "lucide-react"

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
      if (result.roadmapId) {
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
      // Still redirect to dashboard, they can retry
      router.push("/dashboard")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleBack = () => {
    router.push("/onboarding/step/5")
  }

  const allTopics = Object.values(topicCategories).flat()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Step 6 of 6</span>
            <span className="text-sm font-medium text-primary">100%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: "100%" }} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-background border rounded-xl p-6 md:p-8 shadow-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Topics of interest</h1>
            <p className="text-muted-foreground">
              Select all that apply — we'll prioritize these in your roadmap
            </p>
          </div>

          {/* Custom topic input */}
          <div className="mb-6">
            <Label className="text-base font-medium mb-2 block">Add custom topic</Label>
            <div className="flex gap-2">
              <Input
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomTopic())}
                placeholder="e.g., GraphQL Subscriptions"
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={addCustomTopic} disabled={!customTopic.trim()}>
                Add
              </Button>
            </div>
          </div>

          {/* Predefined topics by category */}
          <div className="space-y-6 max-h-96 overflow-y-auto pr-2">
            {Object.entries(topicCategories).map(([category, topics]) => (
              <div key={category} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {category}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {topics.map((topic) => (
                    <label
                      key={topic}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-all hover:border-primary/50",
                        selectedTopics.includes(topic)
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-input hover:bg-muted/50"
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
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Selected ({selectedTopics.length}):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedTopics.map((topic) => (
                  <span
                    key={topic}
                    className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4 mt-8">
            <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button type="submit" className="flex-1 gap-2" disabled={selectedTopics.length === 0 || isGenerating}>
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

          <p className="text-center text-xs text-muted-foreground mt-4">
            This may take 15-30 seconds. We're creating a complete personalized roadmap with phases,
            modules, lessons, and quizzes.
          </p>
        </form>
      </div>
    </div>
  )
}