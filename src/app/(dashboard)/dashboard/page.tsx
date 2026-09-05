"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  BookOpen,
  Brain,
  Target,
  Flame,
  Clock,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Plus,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Roadmap {
  id: string
  title: string
  topic: string
  status: string
  current_phase: number
  updated_at: string
  roadmap_phases: Array<{
    id: string
    title: string
    order_index: number
    roadmap_modules: Array<{
      id: string
      title: string
      order_index: number
      lessons: Array<{
        id: string
        title: string
        order_index: number
        completed: boolean
      }>
    }>
  }>
}

interface Stats {
  totalRoadmaps: number
  completedLessons: number
  studyStreak: number
  totalHours: number
}

export default function DashboardPage() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([])
  const [stats, setStats] = useState<Stats>({
    totalRoadmaps: 0,
    completedLessons: 0,
    studyStreak: 0,
    totalHours: 0,
  })
  const [loading, setLoading] = useState(true)
  const [activeRoadmap, setActiveRoadmap] = useState<Roadmap | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
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

      // Fetch user's roadmaps with phases/modules/lessons
      const { data: roadmapsData, error: roadmapsError } = await supabase
        .from("roadmaps")
        .select(`
          *,
          roadmap_phases (
            id, title, order_index,
            roadmap_modules (
              id, title, order_index,
              lessons (id, title, order_index, completed)
            )
          )
        `)
        .eq("user_id", profile.id)
        .order("updated_at", { ascending: false })

      if (roadmapsError) throw roadmapsError

      setRoadmaps(roadmapsData || [])
      if (roadmapsData && roadmapsData.length > 0) {
        setActiveRoadmap(roadmapsData[0])
      }

      // Fetch study sessions for stats
      const { data: sessionsData } = await supabase
        .from("study_sessions")
        .select("duration, created_at")
        .eq("user_id", profile.id)

      const { data: conceptsData } = await supabase
        .from("user_concepts")
        .select("mastery_level")
        .eq("user_id", profile.id)

      // Calculate stats
      const completedLessons = roadmapsData?.reduce((acc: number, r: any) => {
        return acc + (r.roadmap_phases?.reduce((pAcc: number, p: any) => {
          return pAcc + (p.roadmap_modules?.reduce((mAcc: number, m: any) => {
            return mAcc + (m.lessons?.filter((l: any) => l.completed).length || 0)
          }, 0) || 0)
        }, 0) || 0)
      }, 0) || 0

      const totalMinutes = sessionsData?.reduce((acc, s) => acc + (s.duration || 0), 0) || 0
      const totalHours = Math.round(totalMinutes / 60)

      // Simple streak calculation (consecutive days with sessions)
      const uniqueDays = new Set(
        sessionsData?.map((s) => new Date(s.created_at).toDateString()) || []
      )
      let streak = 0
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      for (let i = 0; i < 365; i++) {
        const checkDate = new Date(today)
        checkDate.setDate(today.getDate() - i)
        if (uniqueDays.has(checkDate.toDateString())) {
          streak++
        } else if (i > 0) {
          break
        }
      }

      setStats({
        totalRoadmaps: roadmapsData?.length || 0,
        completedLessons,
        studyStreak: streak,
        totalHours,
      })
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const getProgress = (roadmap: Roadmap) => {
    let total = 0
    let completed = 0
    roadmap.roadmap_phases?.forEach((phase) => {
      phase.roadmap_modules?.forEach((module) => {
        module.lessons?.forEach((lesson) => {
          total++
          if (lesson.completed) completed++
        })
      })
    })
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }

  const getCurrentLesson = (roadmap: Roadmap) => {
    for (const phase of roadmap.roadmap_phases || []) {
      for (const module of phase.roadmap_modules || []) {
        for (const lesson of module.lessons || []) {
          if (!lesson.completed) {
            return { phase: phase.title, module: module.title, lesson: lesson.title }
          }
        }
      }
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Welcome back!</h1>
          <p className="text-muted-foreground mt-1">
            Continue your learning journey where you left off
          </p>
        </div>
        <Link href="/dashboard/roadmaps/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Roadmap
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Roadmaps"
          value={stats.totalRoadmaps}
          icon={BookOpen}
          trend="+2 this month"
        />
        <StatCard
          title="Lessons Completed"
          value={stats.completedLessons}
          icon={Target}
          trend="+5 this week"
        />
        <StatCard
          title="Study Streak"
          value={`${stats.studyStreak} days`}
          icon={Flame}
          trend={stats.studyStreak > 0 ? "Keep it up!" : "Start today"}
        />
        <StatCard
          title="Total Study Time"
          value={`${stats.totalHours}h`}
          icon={Clock}
          trend="This month"
        />
      </div>

      {/* Active Roadmap */}
      {activeRoadmap && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Continue Learning</h2>
            <Link href={`/dashboard/roadmaps/${activeRoadmap.id}`}>
              <Button variant="ghost" className="gap-1">
                View Roadmap
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{activeRoadmap.title}</h3>
                    <p className="text-muted-foreground">{activeRoadmap.topic}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span className="font-medium">{getProgress(activeRoadmap)}%</span>
                    </div>
                    <Progress value={getProgress(activeRoadmap)} className="h-2" />
                  </div>

                  {getCurrentLesson(activeRoadmap) && (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="hidden sm:inline">Next:</span>
                      <span className="font-medium text-foreground">
                        {getCurrentLesson(activeRoadmap)!.lesson}
                      </span>
                    </div>
                  )}

                  <Link href={`/dashboard/roadmaps/${activeRoadmap.id}`}>
                    <Button className="w-full sm:w-auto gap-2" size="lg">
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* All Roadmaps */}
      {roadmaps.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Your Roadmaps</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roadmaps.map((roadmap) => (
              <RoadmapCard
                key={roadmap.id}
                roadmap={roadmap}
                progress={getProgress(roadmap)}
                currentLesson={getCurrentLesson(roadmap)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {roadmaps.length === 0 && (
        <Card className="text-center py-12">
          <CardContent className="pt-6">
            <Sparkles className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No roadmaps yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first personalized learning roadmap
            </p>
            <Link href="/dashboard/roadmaps/new">
              <Button className="gap-2" size="lg">
                <Plus className="h-4 w-4" />
                Create Roadmap
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
}: {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  trend: string
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{trend}</p>
          </div>
          <div className="p-3 bg-muted rounded-xl">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RoadmapCard({
  roadmap,
  progress,
  currentLesson,
}: {
  roadmap: Roadmap
  progress: number
  currentLesson: { phase: string; module: string; lesson: string } | null
}) {
  const statusColors = {
    active: "bg-green-100 text-green-800",
    paused: "bg-yellow-100 text-yellow-800",
    completed: "bg-blue-100 text-blue-800",
    archived: "bg-gray-100 text-gray-800",
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 pr-4">
            <h3 className="font-semibold text-lg">{roadmap.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{roadmap.topic}</p>
          </div>
          <Badge
            variant="secondary"
            className={cn(
              "text-xs",
              statusColors[roadmap.status as keyof typeof statusColors] ||
                statusColors.active
            )}
          >
            {roadmap.status}
          </Badge>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span>Overall Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          {currentLesson && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Next Lesson</p>
              <p className="text-sm font-medium truncate">{currentLesson.lesson}</p>
              <p className="text-xs text-muted-foreground">
                {currentLesson.phase} › {currentLesson.module}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <span>Updated {formatDistanceToNow(new Date(roadmap.updated_at), { addSuffix: true })}</span>
            <span>Phase {roadmap.current_phase}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}