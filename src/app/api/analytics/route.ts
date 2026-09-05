import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { auth } from "@clerk/nextjs/server"

interface TimeRange {
  weekly: { start: Date; end: Date }
  monthly: { start: Date; end: Date }
}

function getTimeRanges(): TimeRange {
  const now = new Date()
  const weeklyStart = new Date(now)
  weeklyStart.setDate(now.getDate() - 7)
  weeklyStart.setHours(0, 0, 0, 0)

  const monthlyStart = new Date(now)
  monthlyStart.setMonth(now.getMonth() - 1)
  monthlyStart.setHours(0, 0, 0, 0)

  return {
    weekly: { start: weeklyStart, end: now },
    monthly: { start: monthlyStart, end: now },
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const range = searchParams.get("range") || "weekly" // weekly | monthly

    const supabase = await createClient()

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_id", userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    const timeRanges = getTimeRanges()
    const selectedRange = timeRanges[range as keyof TimeRange] || timeRanges.weekly

    // Get study sessions in range
    const { data: sessions, error: sessionsError } = await supabase
      .from("study_sessions")
      .select(`
        id,
        duration,
        activity_type,
        created_at,
        lessons (title, module_id),
        roadmaps (title)
      `)
      .eq("user_id", profile.id)
      .gte("created_at", selectedRange.start.toISOString())
      .lte("created_at", selectedRange.end.toISOString())
      .order("created_at", { ascending: true })

    if (sessionsError) throw sessionsError

    // Get quiz attempts in range
    const { data: attempts, error: attemptsError } = await supabase
      .from("quiz_attempts")
      .select(`
        id,
        score,
        time_spent,
        created_at,
        weakness_analysis,
        quizzes (
          id,
          lesson_id,
          lessons (
            title,
            module_id,
            roadmap_modules (
              phase_id,
              roadmap_phases (
                roadmap_id,
                roadmaps (title)
              )
            )
          )
        )
      `)
      .eq("user_id", profile.id)
      .gte("created_at", selectedRange.start.toISOString())
      .lte("created_at", selectedRange.end.toISOString())
      .order("created_at", { ascending: true })

    if (attemptsError) throw attemptsError

    // Get user concepts (knowledge gaps)
    const { data: concepts, error: conceptsError } = await supabase
      .from("user_concepts")
      .select("*")
      .eq("user_id", profile.id)
      .order("mastery_level", { ascending: true })

    if (conceptsError) throw conceptsError

    // Get roadmaps
    const { data: roadmaps, error: roadmapsError } = await supabase
      .from("roadmaps")
      .select(`
        id,
        title,
        status,
        current_phase,
        created_at,
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

    if (roadmapsError) throw roadmapsError

    // Calculate metrics
    const totalStudyTime = sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0
    const totalSessions = sessions?.length || 0
    const avgSessionLength = totalSessions > 0 ? totalStudyTime / totalSessions : 0

    const quizScores = attempts?.map(a => a.score) || []
    const avgQuizScore = quizScores.length > 0 
      ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) 
      : 0
    const quizzesCompleted = attempts?.length || 0

    // Calculate streaks
    const sortedSessions = sessions?.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ) || []
    
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0
    const sessionDates = new Set(
      sessions?.map(s => new Date(s.created_at).toDateString()) || []
    )
    
    // Check streak from today backwards
    const checkDate = new Date()
    checkDate.setHours(0, 0, 0, 0)
    
    while (sessionDates.has(checkDate.toDateString())) {
      currentStreak++
      checkDate.setDate(checkDate.getDate() - 1)
    }

    // Calculate longest streak
    const allDates = Array.from(sessionDates).sort() as string[]
    for (let i = 0; i < allDates.length; i++) {
      if (i === 0) {
        tempStreak = 1
      } else {
        const prev = new Date(allDates[i - 1])
        const curr = new Date(allDates[i])
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays === 1) {
          tempStreak++
        } else {
          tempStreak = 1
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak)
    }

    // Activity by day (for charts)
    const activityByDay: Record<string, { studyTime: number; sessions: number; quizzes: number }> = {}
    sessions?.forEach(s => {
      const day = new Date(s.created_at).toISOString().split('T')[0]
      if (!activityByDay[day]) {
        activityByDay[day] = { studyTime: 0, sessions: 0, quizzes: 0 }
      }
      activityByDay[day].studyTime += s.duration || 0
      activityByDay[day].sessions += 1
    })
    
    attempts?.forEach(a => {
      const day = new Date(a.created_at).toISOString().split('T')[0]
      if (!activityByDay[day]) {
        activityByDay[day] = { studyTime: 0, sessions: 0, quizzes: 0 }
      }
      activityByDay[day].quizzes += 1
    })

    // Knowledge gaps (weak concepts)
    const weakConcepts = concepts?.filter(c => c.mastery_level < 60) || []
    const strongConcepts = concepts?.filter(c => c.mastery_level >= 80) || []

    // Heatmap data for knowledge gaps
    const heatmapData = concepts?.map(c => ({
      concept: c.concept,
      mastery: c.mastery_level,
      attempts: c.total_attempts,
      lastReviewed: c.last_reviewed,
      nextReview: c.next_review,
    })) || []

    // Roadmap progress
    const roadmapProgress = roadmaps?.map(rm => {
      const allLessons = rm.roadmap_phases?.flatMap(p => 
        p.roadmap_modules?.flatMap(m => m.lessons || []) || []
      ) || []
      const completedLessons = allLessons.filter(l => l.completed).length
      const totalLessons = allLessons.length
      const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
      
      return {
        id: rm.id,
        title: rm.title,
        status: rm.status,
        progress,
        completedLessons,
        totalLessons,
        currentPhase: rm.current_phase,
      }
    }) || []

    // Time of day analysis
    const timeOfDay: Record<string, number> = {}
    sessions?.forEach(s => {
      const hour = new Date(s.created_at).getHours()
      const key = `${hour}:00`
      timeOfDay[key] = (timeOfDay[key] || 0) + (s.duration || 0)
    })

    // Activity type breakdown
    const activityBreakdown: Record<string, number> = {}
    sessions?.forEach(s => {
      activityBreakdown[s.activity_type] = (activityBreakdown[s.activity_type] || 0) + (s.duration || 0)
    })

    return NextResponse.json({
      range,
      summary: {
        totalStudyTime,
        totalSessions,
        avgSessionLength: Math.round(avgSessionLength),
        avgQuizScore,
        quizzesCompleted,
        currentStreak,
        longestStreak,
        weakConceptsCount: weakConcepts.length,
        strongConceptsCount: strongConcepts.length,
      },
      activityByDay: Object.entries(activityByDay).map(([date, data]) => ({
        date,
        ...data,
      })),
      heatmapData,
      roadmapProgress,
      timeOfDay: Object.entries(timeOfDay).map(([hour, minutes]) => ({
        hour,
        minutes,
      })),
      activityBreakdown: Object.entries(activityBreakdown).map(([type, minutes]) => ({
        type,
        minutes,
      })),
      weakConcepts: weakConcepts.slice(0, 10).map(c => ({
        concept: c.concept,
        mastery: c.mastery_level,
        nextReview: c.next_review,
      })),
      strongConcepts: strongConcepts.slice(0, 10).map(c => ({
        concept: c.concept,
        mastery: c.mastery_level,
      })),
      recentSessions: sessions?.slice(-10).map(s => {
        const lessons = s.lessons as Array<{ title: string }> | undefined
        const roadmaps = s.roadmaps as Array<{ title: string }> | undefined
        return {
          id: s.id,
          date: s.created_at,
          duration: s.duration,
          activity: s.activity_type,
          lesson: lessons?.[0]?.title,
          roadmap: roadmaps?.[0]?.title,
        }
      }) || [],
      recentQuizzes: attempts?.slice(-10).map(a => {
        const quiz = a.quizzes as {
          lessons?: Array<{
            title: string
            roadmap_modules?: Array<{
              roadmap_phases?: Array<{
                roadmaps?: Array<{ title: string }>
              }>
            }>
          }>
        } | undefined
        const lesson = quiz?.lessons
        const module = lesson?.[0]?.roadmap_modules?.[0]
        const phase = module?.roadmap_phases?.[0]
        const roadmap = phase?.roadmaps?.[0]
        return {
          id: a.id,
          date: a.created_at,
          score: a.score,
          timeSpent: a.time_spent,
          lesson: lesson?.[0]?.title,
          roadmap: roadmap?.title,
        }
      }) || [],
    })
  } catch (error) {
    console.error("Analytics error:", error)
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    )
  }
}