"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { 
  Plus, 
  BookOpen, 
  Clock, 
  TrendingUp, 
  Archive, 
  Edit, 
  Trash2,
  Play,
  ChevronRight,
  Filter,
  Search
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"

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
  roadmap_phases: Array<{
    id: string
    title: string
    order_index: number
    estimated_hours: number
    roadmap_modules: Array<{
      id: string
      title: string
      order_index: number
      estimated_minutes: number
      lessons: Array<{
        id: string
        title: string
        order_index: number
        estimated_minutes: number
        completed: boolean
      }>
    }>
  }>
}

export default function RoadmapsPage() {
  const supabase = createClient()
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("active")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchRoadmaps()
  }, [])

  const fetchRoadmaps = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("clerk_id", user.id)
        .single()

      if (!profile) return

      const { data, error } = await supabase
        .from("roadmaps")
        .select(`
          id,
          title,
          topic,
          description,
          status,
          current_phase,
          version,
          created_at,
          updated_at,
          roadmap_phases (
            id,
            title,
            order_index,
            estimated_hours,
            roadmap_modules (
              id,
              title,
              order_index,
              estimated_minutes,
              lessons (
                id,
                title,
                order_index,
                estimated_minutes,
                completed
              )
            )
          )
        `)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      // Sort phases, modules, lessons by order
      const sorted = (data || []).map(roadmap => ({
        ...roadmap,
        roadmap_phases: (roadmap.roadmap_phases || []).sort((a, b) => a.order_index - b.order_index).map(phase => ({
          ...phase,
          roadmap_modules: (phase.roadmap_modules || []).sort((a, b) => a.order_index - b.order_index).map(module => ({
            ...module,
            lessons: (module.lessons || []).sort((a, b) => a.order_index - b.order_index),
          })),
        })),
      }))

      setRoadmaps(sorted)
    } catch (error) {
      console.error("Failed to fetch roadmaps:", error)
    } finally {
      setLoading(false)
    }
  }

  const getProgress = (roadmap: Roadmap) => {
    const allLessons = roadmap.roadmap_phases.flatMap(p => 
      p.roadmap_modules.flatMap(m => m.lessons)
    )
    const completed = allLessons.filter(l => l.completed).length
    const total = allLessons.length
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }

  const getTotalLessons = (roadmap: Roadmap) => {
    return roadmap.roadmap_phases.flatMap(p => 
      p.roadmap_modules.flatMap(m => m.lessons)
    ).length
  }

  const getCompletedLessons = (roadmap: Roadmap) => {
    return roadmap.roadmap_phases.flatMap(p => 
      p.roadmap_modules.flatMap(m => m.lessons.filter(l => l.completed))
    ).length
  }

  const getTotalHours = (roadmap: Roadmap) => {
    return roadmap.roadmap_phases.reduce((sum, p) => sum + (p.estimated_hours || 0), 0)
  }

  const getNextLesson = (roadmap: Roadmap) => {
    for (const phase of roadmap.roadmap_phases) {
      for (const module of phase.roadmap_modules) {
        for (const lesson of module.lessons) {
          if (!lesson.completed) {
            return { lesson, phase: phase.title, module: module.title }
          }
        }
      }
    }
    return null
  }

  const filteredRoadmaps = roadmaps.filter(r => {
    const matchesTab = activeTab === "all" || r.status === activeTab
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesTab && matchesSearch
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Roadmaps</h1>
            <p className="text-muted-foreground">Manage your learning paths</p>
          </div>
          <Button><Plus className="mr-2 h-4 w-4" /> New Roadmap</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => (
            <Card key={i}><CardContent className="py-8"><div className="h-8 bg-muted animate-pulse rounded w-3/4"></div><div className="h-4 bg-muted animate-pulse rounded mt-2 w-1/2"></div></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  const tabs = [
    { value: "active", label: "Active", count: roadmaps.filter(r => r.status === "active").length },
    { value: "completed", label: "Completed", count: roadmaps.filter(r => r.status === "completed").length },
    { value: "archived", label: "Archived", count: roadmaps.filter(r => r.status === "archived").length },
    { value: "all", label: "All", count: roadmaps.length },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/80">Adaptive learning paths</p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Roadmaps</h1>
          <p className="mt-3 text-sm text-slate-400">Manage and track the paths that turn your goals into momentum.</p>
        </div>
        <Link href="/dashboard/roadmaps/new">
          <Button className="bg-white text-slate-950 hover:bg-cyan-100"><Plus className="mr-2 h-4 w-4" /> Create Roadmap</Button>
        </Link>
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search roadmaps..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-1 sm:flex-none">
            {tabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label} <Badge variant="secondary" className="ml-2">{tab.count}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Roadmaps Grid */}
      {filteredRoadmaps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            {roadmaps.length === 0 ? (
              <>
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No roadmaps yet</h3>
                <p className="text-muted-foreground mb-4">Create your first adaptive learning roadmap</p>
                <Link href="/dashboard/roadmaps/new">
                  <Button className="gap-2"><Plus className="h-4 w-4" /> Create Roadmap</Button>
                </Link>
              </>
            ) : (
              <>
                <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No matching roadmaps</h3>
                <p className="text-muted-foreground">Try adjusting your search or filter</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRoadmaps.map(roadmap => {
            const progress = getProgress(roadmap)
            const nextLesson = getNextLesson(roadmap)
            const totalLessons = getTotalLessons(roadmap)
            const completedLessons = getCompletedLessons(roadmap)
            const totalHours = getTotalHours(roadmap)

            return (
              <Card key={roadmap.id} className="group interactive-lift relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{roadmap.title}</h3>
                        <Badge variant={roadmap.status === "active" ? "default" : roadmap.status === "completed" ? "secondary" : "outline"}>
                          {roadmap.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{roadmap.topic}</p>
                    </div>
                    {roadmap.status === "active" && nextLesson && (
                      <Link href={`/dashboard/roadmaps/${roadmap.id}/lessons/${nextLesson.lesson.id}`}>
                        <Button size="sm" variant="default" className="gap-1">
                          <Play className="h-3.5 w-3.5" />
                          Continue
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {roadmap.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{roadmap.description}</p>
                  )}

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {completedLessons}/{totalLessons} lessons completed
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      {roadmap.roadmap_phases.length} phases
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      ~{totalHours}h
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      v{roadmap.version}
                    </span>
                  </div>

                  {/* Next Lesson */}
                  {nextLesson && (
                    <Link href={`/dashboard/roadmaps/${roadmap.id}/lessons/${nextLesson.lesson.id}`} className="block">
                      <div className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex items-center gap-2 text-sm">
                          <Play className="h-4 w-4 text-primary" />
                          <span className="font-medium truncate">{nextLesson.lesson.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Phase: {nextLesson.phase} • Module: {nextLesson.module}
                        </p>
                      </div>
                    </Link>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Link href={`/dashboard/roadmaps/${roadmap.id}`} className="flex-1">
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-1">
                        <ChevronRight className="h-3.5 w-3.5" />
                        View Details
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}