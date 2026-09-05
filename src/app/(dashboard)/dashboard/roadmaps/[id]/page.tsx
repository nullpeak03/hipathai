"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  ChevronRight,
  ChevronDown,
  CheckCircle,
  Circle,
  BookOpen,
  Play,
  Lock,
  ArrowLeft,
  Sparkles,
  Target,
  Brain,
  RefreshCw,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Roadmap {
  id: string
  title: string
  topic: string
  description: string
  status: string
  current_phase: number
  version: number
  created_at: string
  updated_at: string
  roadmap_phases: Phase[]
}

interface Phase {
  id: string
  title: string
  description: string
  order_index: number
  estimated_hours: number
  roadmap_modules: Module[]
}

interface Module {
  id: string
  title: string
  description: string
  order_index: number
  estimated_minutes: number
  lessons: Lesson[]
}

interface Lesson {
  id: string
  title: string
  content_type: string
  content_data: any
  order_index: number
  estimated_minutes: number
  completed: boolean
}

export default function RoadmapPage() {
  const params = useParams()
  const roadmapId = params.id as string
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    fetchRoadmap()
  }, [roadmapId])

  const fetchRoadmap = async () => {
    try {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("clerk_id", user.id)
        .single()

      if (profileError || !profile) throw profileError || new Error("Profile not found")

      const { data, error } = await supabase
        .from("roadmaps")
        .select(`
          *,
          roadmap_phases (
            id, title, description, order_index, estimated_hours,
            roadmap_modules (
              id, title, description, order_index, estimated_minutes,
              lessons (id, title, content_type, content_data, order_index, estimated_minutes, completed)
            )
          )
        `)
        .eq("id", roadmapId)
        .eq("user_id", profile.id)
        .single()

      if (error) throw error
      setRoadmap(data)
    } catch (error) {
      console.error("Failed to fetch roadmap:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleLessonComplete = async (lessonId: string, completed: boolean) => {
    try {
      const supabase = createClient()

      const { error } = await supabase
        .from("lessons")
        .update({ completed })
        .eq("id", lessonId)

      if (error) throw error

      setRoadmap((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          roadmap_phases: prev.roadmap_phases.map((phase) => ({
            ...phase,
            roadmap_modules: phase.roadmap_modules.map((module) => ({
              ...module,
              lessons: module.lessons.map((lesson) =>
                lesson.id === lessonId ? { ...lesson, completed } : lesson
              ),
            })),
          })),
        }
      })
    } catch (error) {
      console.error("Failed to update lesson:", error)
    }
  }

  const getProgress = () => {
    if (!roadmap) return 0
    let total = 0
    let completed = 0
    roadmap.roadmap_phases.forEach((phase) => {
      phase.roadmap_modules.forEach((module) => {
        module.lessons.forEach((lesson) => {
          total++
          if (lesson.completed) completed++
        })
      })
    })
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }

  const getPhaseProgress = (phase: Phase) => {
    let total = 0
    let completed = 0
    phase.roadmap_modules.forEach((module) => {
      module.lessons.forEach((lesson) => {
        total++
        if (lesson.completed) completed++
      })
    })
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }

  const getModuleProgress = (module: Module) => {
    const total = module.lessons.length
    const completed = module.lessons.filter((l) => l.completed).length
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!roadmap) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Roadmap not found</h2>
        <Link href="/dashboard">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    )
  }

  const progress = getProgress()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-muted rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{roadmap.title}</h1>
            <p className="text-muted-foreground">{roadmap.topic}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={roadmap.status === "active" ? "success" : "secondary"}>
            {roadmap.status}
          </Badge>
          <Badge variant="outline">v{roadmap.version}</Badge>
          <Button variant="outline" className="gap-1">
            <RefreshCw className="h-4 w-4" />
            Adapt
          </Button>
        </div>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-2xl font-bold text-primary">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">
                {roadmap.roadmap_phases.reduce((acc, p) => acc + p.roadmap_modules.reduce((mAcc, m) => mAcc + m.lessons.length, 0), 0)} lessons total
              </p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-xl">
              <Target className="h-10 w-10 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {roadmap.roadmap_phases.reduce((acc, p) => acc + p.roadmap_modules.reduce((mAcc, m) => mAcc + m.lessons.filter((l) => l.completed).length, 0), 0)}
              </p>
              <p className="text-sm text-muted-foreground">Lessons Completed</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-xl">
              <Brain className="h-10 w-10 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {roadmap.roadmap_phases.reduce((acc, p) => acc + p.estimated_hours, 0)}h
              </p>
              <p className="text-sm text-muted-foreground">Estimated Time</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="phases">Phases & Lessons</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>About this Roadmap</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{roadmap.description}</p>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <StatItem icon={BookOpen} label="Phases" value={roadmap.roadmap_phases.length} />
              <StatItem
                icon={Sparkles}
                label="Modules"
                value={roadmap.roadmap_phases.reduce((acc, p) => acc + p.roadmap_modules.length, 0)}
              />
              <StatItem
                icon={Target}
                label="Total Lessons"
                value={roadmap.roadmap_phases.reduce((acc, p) => acc + p.roadmap_modules.reduce((mAcc, m) => mAcc + m.lessons.length, 0), 0)}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="phases">
          <div className="space-y-4">
            {roadmap.roadmap_phases.map((phase, phaseIndex) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                phaseIndex={phaseIndex}
                isExpanded={expandedPhase === phase.id}
                onToggle={() => setExpandedPhase(expandedPhase === phase.id ? null : phase.id)}
                progress={getPhaseProgress(phase)}
                onLessonToggle={toggleLessonComplete}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Learning Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Detailed analytics coming soon. This will show:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Time spent per phase/module
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Quiz scores and weakness analysis
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Study streak and consistency
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Knowledge gap heatmap
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PhaseCard({
  phase,
  phaseIndex,
  isExpanded,
  onToggle,
  progress,
  onLessonToggle,
}: {
  phase: Phase
  phaseIndex: number
  isExpanded: boolean
  onToggle: () => void
  progress: number
  onLessonToggle: (lessonId: string, completed: boolean) => void
}) {
  return (
    <Card>
      <CardHeader className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0" onClick={onToggle}>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 transition-transform",
                isExpanded && "rotate-90"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">Phase {phaseIndex + 1}</span>
                <Badge variant="outline" className="text-xs">
                  {phase.roadmap_modules.reduce((acc, m) => acc + m.lessons.length, 0)} lessons
                </Badge>
                <Badge variant="outline" className="text-xs">
                  ~{phase.estimated_hours}h
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">{phase.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 ml-4">
            <div className="w-32">
              <Progress value={progress} className="h-1.5" />
            </div>
            <span className="text-sm font-medium w-12 text-right">{progress}%</span>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 pb-4">
          <div className="ml-12 space-y-4 border-l-2 border-muted/50 pl-4">
            {phase.roadmap_modules.map((module, moduleIndex) => (
              <ModuleCard
                key={module.id}
                module={module}
                moduleIndex={moduleIndex}
                progress={getModuleProgress(module)}
                onLessonToggle={onLessonToggle}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

function getModuleProgress(module: Module) {
  const total = module.lessons.length
  const completed = module.lessons.filter((l) => l.completed).length
  return total > 0 ? Math.round((completed / total) * 100) : 0
}

function ModuleCard({
  module,
  moduleIndex,
  progress,
  onLessonToggle,
}: {
  module: Module
  moduleIndex: number
  progress: number
  onLessonToggle: (lessonId: string, completed: boolean) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-sm font-medium text-muted-foreground">
            Module {moduleIndex + 1}
          </span>
          <h4 className="font-medium truncate">{module.title}</h4>
          <Badge variant="secondary" className="text-xs">
            {module.lessons.length} lessons
          </Badge>
        </div>
        <div className="flex items-center gap-3 ml-4">
          <div className="w-24">
            <Progress value={progress} className="h-1.5" />
          </div>
          <span className="text-xs font-medium w-10 text-right">{progress}%</span>
        </div>
      </div>

      <div className="ml-8 space-y-2 border-l border-muted/50 pl-4">
        {module.lessons.map((lesson, lessonIndex) => (
          <LessonItem
            key={lesson.id}
            lesson={lesson}
            lessonIndex={lessonIndex}
            onToggle={onLessonToggle}
          />
        ))}
      </div>
    </div>
  )
}

function LessonItem({
  lesson,
  lessonIndex,
  onToggle,
}: {
  lesson: Lesson
  lessonIndex: number
  onToggle: (lessonId: string, completed: boolean) => void
}) {
  const contentIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    video: Play,
    text: BookOpen,
    interactive: Brain,
    quiz: Target,
    default: BookOpen,
  }
  const Icon = contentIcons[lesson.content_type] || contentIcons.default

  return (
    <div className="flex items-center gap-3 py-2 hover:bg-muted/50 rounded-lg px-2 transition-colors">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-6 w-6",
          lesson.completed && "text-green-500"
        )}
        onClick={() => onToggle(lesson.id, !lesson.completed)}
      >
        {lesson.completed ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </Button>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          lesson.completed && "line-through text-muted-foreground"
        )}>
          {lesson.title}
        </p>
        <p className="text-xs text-muted-foreground">
          ~{lesson.estimated_minutes} min • {lesson.content_type}
        </p>
      </div>
      {lesson.completed && (
        <CheckCircle className="h-4 w-4 text-green-500" />
      )}
    </div>
  )
}

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
}) {
  return (
    <div className="text-center p-4 bg-muted/50 rounded-xl">
      <Icon className="h-8 w-8 text-primary mx-auto mb-2" />
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}