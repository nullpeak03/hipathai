"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Logo } from "@/components/brand/logo"
import { 
  Flame, 
  Target, 
  Trophy, 
  BookOpen, 
  Clock, 
  Brain, 
  TrendingUp,
  Award,
  Star,
  Calendar,
  CheckCircle,
  Sparkles
} from "lucide-react"
import { formatDistanceToNow, format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns"

interface Profile {
  id: string
  username: string | null
  avatar_url: string | null
  theme: string
  timezone: string
  learning_goals: string[]
  created_at: string
}

interface Stats {
  totalStudyTime: number
  totalSessions: number
  currentStreak: number
  longestStreak: number
  quizzesCompleted: number
  avgQuizScore: number
  lessonsCompleted: number
  roadmapsCompleted: number
}

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  earnedAt: string | null
  progress: number
  maxProgress: number
}

const ACHIEVEMENTS: Omit<Achievement, "earnedAt" | "progress">[] = [
  { id: "first_lesson", name: "First Steps", description: "Complete your first lesson", icon: "🎯", maxProgress: 1 },
  { id: "streak_3", name: "Getting Started", description: "3 day learning streak", icon: "🔥", maxProgress: 3 },
  { id: "streak_7", name: "Week Warrior", description: "7 day learning streak", icon: "🗓️", maxProgress: 7 },
  { id: "streak_30", name: "Monthly Master", description: "30 day learning streak", icon: "🏆", maxProgress: 30 },
  { id: "lessons_10", name: "Knowledge Seeker", description: "Complete 10 lessons", icon: "📚", maxProgress: 10 },
  { id: "lessons_50", name: "Scholar", description: "Complete 50 lessons", icon: "🎓", maxProgress: 50 },
  { id: "quizzes_10", name: "Quiz Master", description: "Complete 10 quizzes", icon: "❓", maxProgress: 10 },
  { id: "perfect_score", name: "Perfectionist", description: "Score 100% on a quiz", icon: "💯", maxProgress: 1 },
  { id: "roadmap_1", name: "Pathfinder", description: "Complete your first roadmap", icon: "🗺️", maxProgress: 1 },
  { id: "night_owl", name: "Night Owl", description: "Study after 10 PM", icon: "🦉", maxProgress: 1 },
  { id: "early_bird", name: "Early Bird", description: "Study before 7 AM", icon: "🐦", maxProgress: 1 },
  { id: "weekend_warrior", name: "Weekend Warrior", description: "Study on 5 weekends", icon: "⚔️", maxProgress: 5 },
]

export default function ProfilePage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("clerk_id", user.id)
        .single()

      if (profileError) throw profileError
      if (!profileData) return

      setProfile(profileData)

      // Fetch stats
      const [
        { data: sessions },
        { data: attempts },
        { data: roadmaps },
        { data: concepts }
      ] = await Promise.all([
        supabase.from("study_sessions").select("duration, created_at").eq("user_id", profileData.id),
        supabase.from("quiz_attempts").select("score, created_at").eq("user_id", profileData.id),
        supabase.from("roadmaps").select("id, status, roadmap_phases(roadmap_modules(lessons(id, completed)))").eq("user_id", profileData.id),
        supabase.from("user_concepts").select("mastery_level").eq("user_id", profileData.id),
      ])

      // Calculate stats
      const totalStudyTime = sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0
      const totalSessions = sessions?.length || 0
      const quizzesCompleted = attempts?.length || 0
      const avgQuizScore = attempts && attempts.length > 0
        ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length)
        : 0

      // Calculate streaks
      const sessionDates = new Set(
        sessions?.map(s => new Date(s.created_at).toDateString()) || []
      )
      
      let currentStreak = 0
      const checkDate = new Date()
      checkDate.setHours(0, 0, 0, 0)
      while (sessionDates.has(checkDate.toDateString())) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      }

      let longestStreak = 0
      let tempStreak = 0
      const allDates = Array.from(sessionDates).sort() as string[]
      for (let i = 0; i < allDates.length; i++) {
        if (i === 0) tempStreak = 1
        else {
          const prev = new Date(allDates[i - 1])
          const curr = new Date(allDates[i])
          const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
          tempStreak = diffDays === 1 ? tempStreak + 1 : 1
        }
        longestStreak = Math.max(longestStreak, tempStreak)
      }

      // Count completed lessons
      let lessonsCompleted = 0
      let roadmapsCompleted = 0
      roadmaps?.forEach(r => {
        const allLessons = r.roadmap_phases?.flatMap(p => 
          p.roadmap_modules?.flatMap(m => m.lessons || []) || []
        ) || []
        lessonsCompleted += allLessons.filter(l => l.completed).length
        if (r.status === "completed") roadmapsCompleted++
      })

      setStats({
        totalStudyTime,
        totalSessions,
        currentStreak,
        longestStreak,
        quizzesCompleted,
        avgQuizScore,
        lessonsCompleted,
        roadmapsCompleted,
      })

      // Calculate achievements
      const earnedAchievements = ACHIEVEMENTS.map(a => {
        let progress = 0
        let earnedAt: string | null = null

        switch (a.id) {
          case "first_lesson":
            progress = lessonsCompleted > 0 ? 1 : 0
            earnedAt = lessonsCompleted > 0 ? sessions?.[0]?.created_at || null : null
            break
          case "streak_3":
            progress = Math.min(currentStreak, 3)
            earnedAt = currentStreak >= 3 ? new Date().toISOString() : null
            break
          case "streak_7":
            progress = Math.min(currentStreak, 7)
            earnedAt = currentStreak >= 7 ? new Date().toISOString() : null
            break
          case "streak_30":
            progress = Math.min(currentStreak, 30)
            earnedAt = currentStreak >= 30 ? new Date().toISOString() : null
            break
          case "lessons_10":
            progress = Math.min(lessonsCompleted, 10)
            earnedAt = lessonsCompleted >= 10 ? new Date().toISOString() : null
            break
          case "lessons_50":
            progress = Math.min(lessonsCompleted, 50)
            earnedAt = lessonsCompleted >= 50 ? new Date().toISOString() : null
            break
          case "quizzes_10":
            progress = Math.min(quizzesCompleted, 10)
            earnedAt = quizzesCompleted >= 10 ? new Date().toISOString() : null
            break
          case "perfect_score":
            progress = attempts?.some(a => a.score === 100) ? 1 : 0
            earnedAt = attempts?.find(a => a.score === 100)?.created_at || null
            break
          case "roadmap_1":
            progress = roadmapsCompleted > 0 ? 1 : 0
            earnedAt = roadmapsCompleted > 0 ? new Date().toISOString() : null
            break
          case "night_owl":
            progress = sessions?.some(s => new Date(s.created_at).getHours() >= 22) ? 1 : 0
            earnedAt = sessions?.find(s => new Date(s.created_at).getHours() >= 22)?.created_at || null
            break
          case "early_bird":
            progress = sessions?.some(s => new Date(s.created_at).getHours() < 7) ? 1 : 0
            earnedAt = sessions?.find(s => new Date(s.created_at).getHours() < 7)?.created_at || null
            break
          case "weekend_warrior":
            const weekendDays = sessions?.filter(s => {
              const day = new Date(s.created_at).getDay()
              return day === 0 || day === 6
            }).length || 0
            progress = Math.min(weekendDays, 5)
            earnedAt = weekendDays >= 5 ? new Date().toISOString() : null
            break
        }

        return { ...a, progress, earnedAt }
      })

      setAchievements(earnedAchievements)
    } catch (error) {
      console.error("Failed to fetch profile:", error)
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

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-muted animate-pulse"></div>
              <div>
                <div className="h-6 bg-muted animate-pulse rounded w-48"></div>
                <div className="h-4 bg-muted animate-pulse rounded w-32 mt-2"></div>
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {[1,2,3,4].map(i => (
              <Card key={i}><CardContent className="py-6"><div className="h-8 bg-muted animate-pulse rounded w-3/4"></div><div className="h-4 bg-muted animate-pulse rounded mt-2 w-1/2"></div></CardContent></Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!profile || !stats) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Failed to load profile</p>
      </div>
    )
  }

  const earnedCount = achievements.filter(a => a.earnedAt).length
  const totalAchievements = achievements.length

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Logo className="mb-6" />

      {/* Profile Header */}
      <Card className="interactive-lift mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.username || "User"} />
              <AvatarFallback className="text-3xl font-bold">
                {profile.username?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{profile.username || "Learner"}</h1>
              <p className="text-muted-foreground">
                Member since {format(new Date(profile.created_at), "MMMM yyyy")}
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-4 mt-4">
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  {profile.learning_goals?.length || 0} Goals
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Calendar className="h-3 w-3" />
                  {profile.timezone}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{earnedCount}</p>
                <p className="text-sm text-muted-foreground">/{totalAchievements}</p>
                <p className="text-xs text-muted-foreground">Achievements</p>
              </div>
              <div className="w-px h-12 bg-muted" />
              <div className="text-center">
                <p className="text-2xl font-bold">{stats.currentStreak}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard 
          icon={Clock} 
          label="Total Study Time" 
          value={formatMinutes(stats.totalStudyTime)} 
          color="purple"
          subtitle={`${stats.totalSessions} sessions`}
        />
        <StatCard 
          icon={Target} 
          label="Avg Quiz Score" 
          value={`${stats.avgQuizScore}%`} 
          color="purple"
          subtitle={`${stats.quizzesCompleted} quizzes`}
        />
        <StatCard 
          icon={BookOpen} 
          label="Lessons Completed" 
          value={stats.lessonsCompleted} 
          color="purple"
          subtitle={`${stats.roadmapsCompleted} roadmaps`}
        />
        <StatCard 
          icon={Flame} 
          label="Longest Streak" 
          value={`${stats.longestStreak} days`} 
          color="purple"
          subtitle={`Current: ${stats.currentStreak} days`}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview"><TrendingUp className="mr-2 h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="achievements"><Award className="mr-2 h-4 w-4" /> Achievements</TabsTrigger>
          <TabsTrigger value="progress"><Brain className="mr-2 h-4 w-4" /> Progress</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Weekly Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  This Week's Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WeeklyActivityChart userId={profile.id} supabase={supabase} />
              </CardContent>
            </Card>

            {/* Learning Goals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Learning Goals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profile.learning_goals && profile.learning_goals.length > 0 ? (
                  <ul className="space-y-3">
                    {profile.learning_goals.map((goal, i) => (
                      <li key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Target className="h-4 w-4 text-primary" />
                        </div>
                        <span>{goal}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No learning goals set yet</p>
                    <p className="text-sm">Add goals in Settings to personalize your roadmaps</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Achievements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Recent Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {achievements
                    .filter(a => a.earnedAt)
                    .sort((a, b) => new Date(b.earnedAt!).getTime() - new Date(a.earnedAt!).getTime())
                    .slice(0, 5)
                    .map(achievement => (
                      <div key={achievement.id} className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
                        <span className="text-2xl">{achievement.icon}</span>
                        <div className="flex-1">
                          <p className="font-medium">{achievement.name}</p>
                          <p className="text-sm text-muted-foreground">{achievement.description}</p>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          Earned {formatDistanceToNow(new Date(achievement.earnedAt!), { addSuffix: true })}
                        </Badge>
                      </div>
                    ))}
                  {achievements.filter(a => a.earnedAt).length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No achievements earned yet. Keep learning!</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Concept Mastery */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Top Concepts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ConceptMastery userId={profile.id} supabase={supabase} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map(achievement => (
              <Card 
                key={achievement.id} 
                className={`relative overflow-hidden ${achievement.earnedAt ? "border-green-200 dark:border-green-800" : "opacity-60"}`}
              >
                <CardContent className="p-6">
                  <div className="text-4xl mb-3">{achievement.icon}</div>
                  <h3 className="font-semibold">{achievement.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{achievement.description}</p>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span className="font-medium">{achievement.progress}/{achievement.maxProgress}</span>
                    </div>
                    <Progress value={(achievement.progress / achievement.maxProgress) * 100} className="h-2" />
                  </div>

                  {achievement.earnedAt && (
                    <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm text-green-700 dark:text-green-400">
                      ✓ Earned {formatDistanceToNow(new Date(achievement.earnedAt), { addSuffix: true })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Roadmap Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <RoadmapProgressList userId={profile.id} supabase={supabase} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, subtitle }: { 
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  color: string
  subtitle?: string
}) {
  const colors = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colors[color as keyof typeof colors]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function WeeklyActivityChart({ userId, supabase }: { userId: string; supabase: ReturnType<typeof createClient> }) {
  const [data, setData] = useState<Array<{ date: string; minutes: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const weekStart = startOfWeek(new Date())
      const weekEnd = endOfWeek(new Date())
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

      const { data: sessions } = await supabase
        .from("study_sessions")
        .select("duration, created_at")
        .eq("user_id", userId)
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString())

      const dayMap = new Map(days.map(d => [format(d, "yyyy-MM-dd"), 0]))
      sessions?.forEach(s => {
        const day = format(new Date(s.created_at), "yyyy-MM-dd")
        dayMap.set(day, (dayMap.get(day) || 0) + (s.duration || 0))
      })

      setData(Array.from(dayMap.entries()).map(([date, minutes]) => ({ date, minutes })))
      setLoading(false)
    }
    fetchData()
  }, [userId, supabase])

  const maxMinutes = Math.max(1, Math.max(...data.map(d => d.minutes), 1))
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  if (loading) {
    return <div className="h-32 flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between h-32 gap-1">
        {data.map((day, i) => (
          <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
            <div 
              className="w-full bg-primary/20 rounded-t transition-all hover:bg-primary/30 cursor-pointer relative group"
              style={{ height: `${Math.max(4, (day.minutes / maxMinutes) * 100)}%` }}
            >
              <div className="absolute bottom-full left-0 right-0 mb-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                {day.minutes > 0 ? `${day.minutes}m` : "—"}
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{dayLabels[i]}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Total: {data.reduce((sum, d) => sum + d.minutes, 0)} minutes this week
      </p>
    </div>
  )
}

function ConceptMastery({ userId, supabase }: { userId: string; supabase: ReturnType<typeof createClient> }) {
  const [data, setData] = useState<Array<{ concept: string; mastery: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data: concepts } = await supabase
        .from("user_concepts")
        .select("concept, mastery_level")
        .eq("user_id", userId)
        .order("mastery_level", { ascending: false })
        .limit(8)

      setData(concepts?.map(c => ({ concept: c.concept, mastery: c.mastery_level })) || [])
      setLoading(false)
    }
    fetchData()
  }, [userId, supabase])

  if (loading) {
    return <div className="h-32 flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Complete quizzes to see concept mastery</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="truncate pr-2">{item.concept}</span>
            <span className="font-medium" style={{ color: item.mastery >= 80 ? "#22c55e" : item.mastery >= 60 ? "#eab308" : "#ef4444" }}>
              {item.mastery}%
            </span>
          </div>
          <Progress value={item.mastery} className="h-1.5" />
        </div>
      ))}
    </div>
  )
}

function RoadmapProgressList({ userId, supabase }: { userId: string; supabase: ReturnType<typeof createClient> }) {
  const [data, setData] = useState<Array<{ id: string; title: string; progress: number; status: string; completed: number; total: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data: roadmaps } = await supabase
        .from("roadmaps")
        .select(`
          id, title, status,
          roadmap_phases(roadmap_modules(lessons(id, completed)))
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      const processed = roadmaps?.map(r => {
        const allLessons = r.roadmap_phases?.flatMap(p => 
          p.roadmap_modules?.flatMap(m => m.lessons || []) || []
        ) || []
        const completed = allLessons.filter(l => l.completed).length
        const total = allLessons.length
        return {
          id: r.id,
          title: r.title,
          progress: total > 0 ? Math.round((completed / total) * 100) : 0,
          status: r.status,
          completed,
          total,
        }
      }) || []

      setData(processed)
      setLoading(false)
    }
    fetchData()
  }, [userId, supabase])

  if (loading) {
    return <div className="h-32 flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No roadmaps yet. Create your first roadmap!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.map(roadmap => (
        <div key={roadmap.id} className="p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium">{roadmap.title}</h4>
            <Badge variant={roadmap.status === "active" ? "default" : "secondary"}>
              {roadmap.status}
            </Badge>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span>{roadmap.completed}/{roadmap.total} lessons</span>
            <span className="font-bold">{roadmap.progress}%</span>
          </div>
          <Progress value={roadmap.progress} className="h-2" />
        </div>
      ))}
    </div>
  )
}