"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { ArrowLeft, ArrowRight, Sparkles, Loader2, CheckCircle, BookOpen, Clock, Brain, Zap } from "lucide-react"
import Link from "next/link"

const difficultyOptions = [
  { value: "beginner", label: "Beginner - New to this topic", icon: BookOpen },
  { value: "intermediate", label: "Intermediate - Some experience", icon: Brain },
  { value: "advanced", label: "Advanced - Deep experience", icon: Zap },
]

const durationOptions = [
  { value: "short", label: "Short (1-2 weeks, ~10-20 hours)", hours: "10-20" },
  { value: "medium", label: "Medium (3-6 weeks, ~30-60 hours)", hours: "30-60" },
  { value: "long", label: "Long (2-3 months, ~80+ hours)", hours: "80+" },
]

type Step = "details" | "generating" | "preview" | "complete"

interface RoadmapPreview {
  title: string
  description: string
  estimatedTotalHours: number
  phases: Array<{
    id?: string
    title: string
    description: string
    order_index: number
    estimatedHours: number
    modules: Array<{
      id?: string
      title: string
      description: string
      order_index: number
      estimatedMinutes: number
      lessons: Array<{
        id?: string
        title: string
        contentType: string
        order_index: number
        estimatedMinutes: number
        concepts: string[]
        quizRecommended: boolean
      }>
    }>
  }>
}

export default function NewRoadmapPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("details")
  const [topic, setTopic] = useState("")
  const [description, setDescription] = useState("")
  const [difficulty, setDifficulty] = useState("beginner")
  const [duration, setDuration] = useState("medium")
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState("")
  const [error, setError] = useState("")
  const [roadmapId, setRoadmapId] = useState<string | null>(null)
  const [preview, setPreview] = useState<RoadmapPreview | null>(null)

  const steps: { id: Step; title: string; icon: any }[] = [
    { id: "details", title: "Details", icon: Sparkles },
    { id: "generating", title: "Generating", icon: Loader2 },
    { id: "preview", title: "Preview", icon: BookOpen },
    { id: "complete", title: "Complete", icon: CheckCircle },
  ]

  const currentStepIndex = steps.findIndex(s => s.id === step)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return

    setStep("generating")
    setGenerating(true)
    setError("")
    setProgress(0)
    setProgressMessage("Creating roadmap...")

    try {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("clerk_id", user.id)
        .single()

      if (!profile) throw new Error("Profile not found")

      // First create the roadmap
      setProgress(10)
      setProgressMessage("Initializing roadmap structure...")

      const { data: roadmap, error: roadmapError } = await supabase
        .from("roadmaps")
        .insert({
          user_id: profile.id,
          title: topic,
          topic: topic,
          description: description || `Learning roadmap for ${topic}`,
          status: "generating",
          current_phase: 1,
          version: 1,
        })
        .select()
        .single()

      if (roadmapError) throw roadmapError

      setRoadmapId(roadmap.id)
      setProgress(30)
      setProgressMessage("AI is designing your learning path...")

      // Call the generation API
      const response = await fetch("/api/roadmaps/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roadmapId: roadmap.id,
          topic,
          description,
          difficulty,
          duration,
        }),
      })

      setProgress(70)
      setProgressMessage("Creating phases, modules, lessons, and quizzes...")

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Generation failed")

      setProgress(90)
      setProgressMessage("Finalizing...")

      // Fetch the generated roadmap for preview
      const { data: fullRoadmap } = await supabase
        .from("roadmaps")
        .select(`
          id, title, description, estimated_total_hours,
          roadmap_phases (
            id, title, description, order_index, estimated_hours,
            roadmap_modules (
              id, title, description, order_index, estimated_minutes,
              lessons (
                id, title, content_type, order_index, estimated_minutes, content_data
              )
            )
          )
        `)
        .eq("id", roadmap.id)
        .single()

      if (fullRoadmap) {
        setPreview({
          title: fullRoadmap.title,
          description: fullRoadmap.description || "",
          estimatedTotalHours: fullRoadmap.estimated_total_hours || 0,
          phases: fullRoadmap.roadmap_phases?.map((p: any) => ({
            ...p,
            modules: p.roadmap_modules?.map((m: any) => ({
              ...m,
              lessons: m.lessons?.map((l: any) => ({
                ...l,
                concepts: l.content_data?.concepts || [],
                quizRecommended: l.content_data?.quizRecommended || false,
              })) || [],
            })) || [],
          })) || [],
        })
      }

      setProgress(100)
      setProgressMessage("Complete!")
      setTimeout(() => setStep("preview"), 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create roadmap")
      setStep("details")
    } finally {
      setGenerating(false)
    }
  }

  const goToStep = (targetStep: Step) => {
    const targetIndex = steps.findIndex(s => s.id === targetStep)
    if (targetIndex <= currentStepIndex || targetStep === "details") {
      setStep(targetStep)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/roadmaps" className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create New Roadmap</h1>
          <p className="text-muted-foreground">
            Describe what you want to learn and we'll generate a complete adaptive roadmap
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="hidden md:flex items-center justify-between">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                i < currentStepIndex ? "bg-primary text-primary-foreground" :
                i === currentStepIndex ? "bg-primary/20 text-primary border border-primary" :
                "bg-muted text-muted-foreground"
              )}>
                {i < currentStepIndex ? <CheckCircle className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
              </div>
              <span className={cn(
                "font-medium text-sm",
                i <= currentStepIndex ? "text-foreground" : "text-muted-foreground"
              )}>
                {s.title}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                "w-16 h-0.5 mx-2",
                i < currentStepIndex ? "bg-primary" : "bg-muted"
              )} />
            )}
          </div>
        ))}
      </div>

      {step === "details" && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Step 1: Roadmap Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="topic">What do you want to learn? *</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., React with TypeScript, Machine Learning, System Design"
                  className="mt-2 text-lg"
                  required
                  maxLength={200}
                  autoFocus
                />
                <p className="text-sm text-muted-foreground mt-1">Be specific - e.g., "Advanced React Patterns" vs just "React"</p>
              </div>

              <div>
                <Label htmlFor="description">Additional context (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Any specific goals, prerequisites, focus areas, or learning style preferences?"
                  className="mt-2"
                  rows={4}
                  maxLength={500}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <Label>Target Difficulty</Label>
                  <div className="grid gap-3 mt-2">
                    {difficultyOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDifficulty(opt.value)}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all text-left",
                          difficulty === opt.value
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <opt.icon className="h-5 w-5 text-primary" />
                          </div>
                          <span className="font-medium">{opt.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Estimated Duration</Label>
                  <div className="grid gap-3 mt-2">
                    {durationOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDuration(opt.value)}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all text-left",
                          duration === opt.value
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-sm text-muted-foreground">{opt.hours} hrs</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="submit" className="gap-2" disabled={!topic.trim()}>
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Generation takes 15-30 seconds. We'll create phases, modules, lessons, and quizzes.
          </p>
        </form>
      )}

      {step === "generating" && (
        <Card className="text-center py-12">
          <CardContent className="space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Generating your roadmap...</h3>
              <p className="text-muted-foreground mt-1">{progressMessage}</p>
            </div>
            <Progress value={progress} className="w-full max-w-md mx-auto" />
            <p className="text-sm text-muted-foreground">
              {progress}%
            </p>
          </CardContent>
        </Card>
      )}

      {step === "preview" && preview && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Step 3: Preview Your Roadmap
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-xl">
                <h4 className="font-semibold text-lg">{preview.title}</h4>
                <p className="text-muted-foreground mt-1">{preview.description}</p>
                <div className="flex gap-6 mt-4 text-sm">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    {preview.phases.length} Phases
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    ~{preview.estimatedTotalHours} hours
                  </span>
                  <span className="flex items-center gap-1">
                    <Brain className="h-4 w-4" />
                    {preview.phases.reduce((sum, p) => sum + p.modules.length, 0)} Modules
                  </span>
                </div>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {preview.phases.map((phase, pIdx) => (
                  <div key={phase.id || pIdx} className="border rounded-xl overflow-hidden">
                    <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                          {phase.order_index}
                        </span>
                        <div>
                          <h5 className="font-semibold">{phase.title}</h5>
                          <p className="text-sm text-muted-foreground">{phase.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{phase.modules.length} modules</span>
                        <span>~{phase.estimatedHours}h</span>
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      {phase.modules.map((module, mIdx) => (
                        <div key={module.id || mIdx} className="pl-12 border-l border-muted/50 py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{module.title}</span>
                              <span className="text-xs text-muted-foreground">{module.estimatedMinutes} min</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {module.lessons.length} lessons
                            </span>
                          </div>
                          <div className="pl-4 mt-1 space-y-1">
                            {module.lessons.slice(0, 3).map((lesson, lIdx) => (
                              <div key={lesson.id || lIdx} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                                <span>{lesson.title}</span>
                                <span className="px-2 py-0.5 text-xs bg-muted rounded">{lesson.contentType}</span>
                                {lesson.quizRecommended && <span className="text-xs text-primary">📝 Quiz</span>}
                              </div>
                            ))}
                            {module.lessons.length > 3 && (
                              <div className="pl-4 text-xs text-muted-foreground">
                                +{module.lessons.length - 3} more lessons
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4 justify-end">
            <Button variant="outline" onClick={() => goToStep("details")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button 
              onClick={() => {
                if (roadmapId) router.push(`/dashboard/roadmaps/${roadmapId}`)
              }}
              className="gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Start Learning
            </Button>
          </div>
        </div>
      )}

      {step === "complete" && roadmapId && (
        <Card className="text-center py-12">
          <CardContent className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold">Roadmap Ready!</h3>
            <p className="text-muted-foreground">Your personalized learning path has been created.</p>
            <Button 
              onClick={() => router.push(`/dashboard/roadmaps/${roadmapId}`)}
              className="w-full max-w-xs mx-auto gap-2"
            >
              <ArrowRight className="h-4 w-4" />
              Start Learning
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}