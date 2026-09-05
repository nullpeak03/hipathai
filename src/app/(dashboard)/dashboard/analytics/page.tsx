"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  Clock, 
  Target, 
  TrendingUp, 
  Flame, 
  Brain, 
  AlertTriangle,
  Download,
  Calendar,
  Activity,
  Trophy,
  BarChart3,
  LayoutDashboard
} from "lucide-react"
import { formatDistanceToNow, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns"

interface AnalyticsData {
  range: string
  summary: {
    totalStudyTime: number
    totalSessions: number
    avgSessionLength: number
    avgQuizScore: number
    quizzesCompleted: number
    currentStreak: number
    longestStreak: number
    weakConceptsCount: number
    strongConceptsCount: number
  }
  activityByDay: Array<{ date: string; studyTime: number; sessions: number; quizzes: number }>
  heatmapData: Array<{ concept: string; mastery: number; attempts: number; lastReviewed: string; nextReview: string }>
  roadmapProgress: Array<{ id: string; title: string; progress: number; completedLessons: number; totalLessons: number; status: string }>
  timeOfDay: Array<{ hour: string; minutes: number }>
  activityBreakdown: Array<{ type: string; minutes: number }>
  weakConcepts: Array<{ concept: string; mastery: number; nextReview: string }>
  strongConcepts: Array<{ concept: string; mastery: number }>
  recentSessions: Array<{ id: string; date: string; duration: number; activity: string; lesson: string; roadmap: string }>
  recentQuizzes: Array<{ id: string; date: string; score: number; timeSpent: number; lesson: string; roadmap: string }>
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<"weekly" | "monthly">("weekly")
  const supabase = createClient()

  useEffect(() => {
    fetchAnalytics()
  }, [range])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/analytics?range=${range}`)
      const result = await response.json()
      if (result.error) throw new Error(result.error)
      setData(result)
    } catch (error) {
      console.error("Failed to fetch analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatMinutes = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const getMasteryColor = (mastery: number) => {
    if (mastery >= 80) return "bg-green-500"
    if (mastery >= 60) return "bg-yellow-500"
    return "bg-red-500"
  }

  const getMasteryLabel = (mastery: number) => {
    if (mastery >= 80) return "Strong"
    if (mastery >= 60) return "Developing"
    return "Needs Work"
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Analytics</h1>
              <p className="text-muted-foreground">Track your learning progress and identify areas for improvement</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1,2,3,4].map(i => (
              <Card key={i}><CardContent className="py-6"><div className="h-8 bg-muted animate-pulse rounded w-3/4"></div><div className="h-4 bg-muted animate-pulse rounded mt-2 w-1/2"></div></CardContent></Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Failed to load analytics data</p>
        <Button onClick={fetchAnalytics} className="mt-4">Retry</Button>
      </div>
    )
  }

  const { summary, activityByDay, heatmapData, roadmapProgress, timeOfDay, activityBreakdown, weakConcepts, strongConcepts, recentSessions, recentQuizzes } = data

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            {range === "weekly" ? "Weekly" : "Monthly"} view • Track progress, identify gaps, optimize learning
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Tabs value={range} onValueChange={(value: string) => setRange(value as "weekly" | "monthly")} className="hidden sm:flex">
            <TabsList>
              <TabsTrigger value="weekly"><Calendar className="mr-2 h-3.5 w-3.5" /> Weekly</TabsTrigger>
              <TabsTrigger value="monthly"><Calendar className="mr-2 h-3.5 w-3.5" /> Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={() => {
            // TODO: Implement export
          }}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Study Time</p>
                <p className="text-3xl font-bold">{formatMinutes(summary.totalStudyTime)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{summary.totalSessions} sessions • {formatMinutes(summary.avgSessionLength)} avg</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average Quiz Score</p>
                <p className="text-3xl font-bold">{summary.avgQuizScore}%</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{summary.quizzesCompleted} quizzes completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Streak</p>
                <p className="text-3xl font-bold">{summary.currentStreak} days</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Flame className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Longest: {summary.longestStreak} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Knowledge Gaps</p>
                <p className="text-3xl font-bold">{summary.weakConceptsCount}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{summary.strongConceptsCount} strong concepts</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview"><BarChart3 className="mr-2 h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="knowledge"><Brain className="mr-2 h-4 w-4" /> Knowledge Gaps</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="mr-2 h-4 w-4" /> Activity</TabsTrigger>
          <TabsTrigger value="roadmaps"><Trophy className="mr-2 h-4 w-4" /> Roadmaps</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Activity Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Daily Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3" style={{ height: "300px" }}>
                  {activityByDay.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No activity data for this period
                    </div>
                  ) : (
                    activityByDay.map((day, i) => (
                      <div key={day.date} className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-20">
                          {format(new Date(day.date), "MMM d")}
                        </span>
                        <div className="flex-1 h-8 bg-muted rounded relative overflow-hidden">
                          <div 
                            className="h-full bg-primary/20 rounded"
                            style={{ width: `${Math.max(5, (day.studyTime / Math.max(1, Math.max(...activityByDay.map(d => d.studyTime)))) * 100)}%` }}
                          />
                          {day.quizzes > 0 && (
                            <div 
                              className="absolute top-0 right-2 h-full w-1 bg-green-500"
                              style={{ height: `${Math.max(10, (day.quizzes / Math.max(1, Math.max(...activityByDay.map(d => d.quizzes)))) * 100)}%` }}
                            />
                          )}
                        </div>
                        <span className="text-sm font-medium w-20 text-right">
                          {formatMinutes(day.studyTime)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-4 mt-4 text-sm">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-primary/20" />
                    Study Time
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-green-500" />
                    Quizzes
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Time of Day Heatmap */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Study Time Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-6 gap-1">
                  {Array.from({ length: 24 }, (_, h) => {
                    const hour = `${h}:00`
                    const data = timeOfDay.find(t => t.hour === hour)
                    const minutes = data?.minutes || 0
                    const maxMinutes = Math.max(1, Math.max(...timeOfDay.map(t => t.minutes), 1))
                    const intensity = minutes / maxMinutes
                    return (
                      <div 
                        key={hour} 
                        className="aspect-square rounded bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer relative group"
                        style={{ backgroundColor: `rgba(59, 130, 246, ${0.05 + intensity * 0.35})` }}
                      >
                        <div className="absolute bottom-1 left-1 right-1 text-xs text-muted-foreground/50">{h}:00</div>
                        <div className="absolute inset-0 flex items-end justify-center p-1">
                          <div className="w-full bg-primary/50 rounded-t" style={{ height: `${intensity * 100}%` }} />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium">
                          {minutes > 0 ? formatMinutes(minutes) : "—"}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Darker cells = more study time. Hover for details.
                </p>
              </CardContent>
            </Card>

            {/* Activity Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Activity Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activityBreakdown.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No activity data</p>
                  ) : (
                    activityBreakdown.map(item => (
                      <div key={item.type} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{item.type.replace("_", " ")}</span>
                          <span className="font-medium">{formatMinutes(item.minutes)}</span>
                        </div>
                        <Progress 
                          value={(item.minutes / Math.max(1, Math.max(...activityBreakdown.map(a => a.minutes)))) * 100} 
                          className="h-2" 
                        />
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Sessions */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentSessions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No recent sessions</p>
                  ) : (
                    recentSessions.slice(0, 8).map(session => (
                      <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <div>
                            <p className="text-sm font-medium">{session.lesson || "Study Session"}</p>
                            <p className="text-xs text-muted-foreground">
                              {session.roadmap} • {formatDistanceToNow(new Date(session.date), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatMinutes(session.duration)}</p>
                          <p className="text-xs text-muted-foreground capitalize">{session.activity}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Knowledge Gaps Tab */}
        <TabsContent value="knowledge" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Weak Concepts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Concepts Needing Review
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {weakConcepts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Great job! No weak concepts detected.</p>
                    </div>
                  ) : (
                    weakConcepts.map((concept, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/50 border border-red-100 dark:border-red-900/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${getMasteryColor(concept.mastery)}`} />
                            <span className="font-medium">{concept.concept}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={getMasteryColor(concept.mastery).replace("bg-", "bg-").replace("500", "100") + " text-" + getMasteryColor(concept.mastery).replace("bg-", "").replace("500", "-700")}>
                              {getMasteryLabel(concept.mastery)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Review by {format(new Date(concept.nextReview), "MMM d")}
                            </span>
                          </div>
                        </div>
                        <Progress value={concept.mastery} className="h-1.5 mt-2" />
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Strong Concepts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-500" />
                  Mastered Concepts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {strongConcepts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Keep learning to build strong concepts!</p>
                    </div>
                  ) : (
                    strongConcepts.map((concept, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/50 border border-green-100 dark:border-green-900/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="font-medium">{concept.concept}</span>
                          </div>
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {concept.mastery}%
                          </Badge>
                        </div>
                        <Progress value={concept.mastery} className="h-1.5 mt-2" />
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Full Heatmap */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutDashboard className="h-5 w-5" />
                  Knowledge Mastery Heatmap
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-12 gap-2">
                  {heatmapData.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Complete quizzes to see your knowledge heatmap</p>
                    </div>
                  ) : (
                    heatmapData.map((concept, i) => (
                      <div 
                        key={i} 
                        className="p-3 rounded-lg border transition-all hover:scale-[1.02] cursor-pointer group"
                        style={{ 
                          backgroundColor: `rgba(${concept.mastery >= 80 ? "34, 197, 94" : concept.mastery >= 60 ? "234, 179, 8" : "239, 68, 68"}, ${0.1 + (concept.mastery / 100) * 0.2})`,
                          borderColor: `rgba(${concept.mastery >= 80 ? "34, 197, 94" : concept.mastery >= 60 ? "234, 179, 8" : "239, 68, 68"}, 0.3)`
                        }}
                      >
                        <div className="font-medium text-sm truncate" title={concept.concept}>
                          {concept.concept}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-2xl font-bold" style={{ color: concept.mastery >= 80 ? "#22c55e" : concept.mastery >= 60 ? "#eab308" : "#ef4444" }}>
                            {concept.mastery}%
                          </span>
                          <span className="text-xs text-muted-foreground">{concept.attempts} attempts</span>
                        </div>
                        <Progress value={concept.mastery} className="h-1 mt-2" />
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span>Last: {formatDistanceToNow(new Date(concept.lastReviewed), { addSuffix: true })}</span>
                          <span>Next: {format(new Date(concept.nextReview), "MMM d")}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Quiz Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentQuizzes.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No quiz attempts yet</p>
                  ) : (
                    recentQuizzes.map(quiz => (
                      <div key={quiz.id} className="p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{quiz.lesson}</p>
                            <p className="text-xs text-muted-foreground">{quiz.roadmap} • {formatDistanceToNow(new Date(quiz.date), { addSuffix: true })}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-2xl font-bold ${quiz.score >= 70 ? "text-green-600" : quiz.score >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                              {quiz.score}%
                            </p>
                            <p className="text-xs text-muted-foreground">{formatMinutes(quiz.timeSpent)}</p>
                          </div>
                        </div>
                        <Progress value={quiz.score} className="h-1.5 mt-2" />
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Weekly Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-primary/5">
                      <p className="text-sm text-muted-foreground">This Week</p>
                      <p className="text-2xl font-bold">{formatMinutes(summary.totalStudyTime)}</p>
                      <p className="text-xs text-muted-foreground">{summary.totalSessions} sessions</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Last Week</p>
                      <p className="text-2xl font-bold">—</p>
                      <p className="text-xs text-muted-foreground">Historical data needed</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Comparative analytics require historical data accumulation
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Roadmaps Tab */}
        <TabsContent value="roadmaps" className="space-y-6">
          <div className="grid gap-6">
            {roadmapProgress.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No active roadmaps</h3>
                  <p className="text-muted-foreground">Complete onboarding to generate your first roadmap</p>
                </CardContent>
              </Card>
            ) : (
              roadmapProgress.map(roadmap => (
                <Card key={roadmap.id}>
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{roadmap.title}</h3>
                          <Badge variant={roadmap.status === "active" ? "default" : "secondary"}>
                            {roadmap.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {roadmap.completedLessons}/{roadmap.totalLessons} lessons completed
                        </p>
                      </div>
                      <div className="w-full sm:w-64">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Progress</span>
                          <span className="font-bold">{roadmap.progress}%</span>
                        </div>
                        <Progress value={roadmap.progress} className="h-3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}