"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { motion } from "framer-motion"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { PageTransition } from "@/components/motion/page-transition"
import { DashboardHero } from "@/components/dashboard/dashboard-hero"
import { RoadmapProgressWidget } from "@/components/dashboard/roadmap-progress-widget"
import { ActivityWidget } from "@/components/dashboard/activity-widget"
import { ReviewWidget } from "@/components/dashboard/review-widget"
import { MasteryWidget } from "@/components/dashboard/mastery-widget"
import { WeeklyGoalWidget } from "@/components/dashboard/weekly-goal-widget"
import { StreakCalendarWidget } from "@/components/dashboard/streak-calendar-widget"
import { QuickActionsWidget } from "@/components/dashboard/quick-actions-widget"
import { chooseNextLesson } from "@/lib/daily-priority"
import { buildDaySeries, buildStreakCalendar, weekToDate } from "@/lib/dashboard"
import { staggerChild, staggerParent } from "@/lib/motion"
import { LESSON_PASS_THRESHOLD } from "@/lib/v2-mastery"
import {
  FRESH_GAM,
  loadDailyActivity,
  loadDueReviews,
  loadGam,
  loadGamAsync,
  loadLearningAnalytics,
  loadPhaseProgress,
  loadProgress,
  loadProgressAsync,
  loadRoadmap,
  loadRoadmapAsync,
  loadWeakTopics,
  type ActivityDay,
  type Gamification,
  type LearningAnalytics,
  type PhaseProgress,
  type Progress,
  type ReviewItem,
  type RoadmapData,
  type WeakTopic,
} from "@/lib/store"

function currentGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export default function Dashboard() {
  const { user } = useUser()
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null)
  const [gam, setGam] = useState<Gamification>(FRESH_GAM)
  const [progress, setProgress] = useState<Progress>({})
  const [phaseProgress, setPhaseProgress] = useState<PhaseProgress>({})
  const [activity, setActivity] = useState<ActivityDay[]>([])
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([])
  const [analytics, setAnalytics] = useState<LearningAnalytics | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [greeting, setGreeting] = useState("Welcome back")

  useEffect(() => {
    setGreeting(currentGreeting())
    // Paint from the local cache immediately, then reconcile with the server.
    setRoadmap(loadRoadmap())
    setGam(loadGam())
    setProgress(loadProgress())
    setHydrated(true)

    let cancelled = false
    void (async () => {
      const [roadmapResult, gamResult, progressResult, activityResult, phaseResult, reviewsResult, weakResult, analyticsResult] =
        await Promise.allSettled([
          loadRoadmapAsync(),
          loadGamAsync(),
          loadProgressAsync(),
          loadDailyActivity(35),
          loadPhaseProgress(),
          loadDueReviews(),
          loadWeakTopics(),
          loadLearningAnalytics(),
        ])

      if (cancelled) return

      if (roadmapResult.status === "fulfilled" && roadmapResult.value) setRoadmap(roadmapResult.value)
      if (gamResult.status === "fulfilled") setGam(gamResult.value)
      if (progressResult.status === "fulfilled") setProgress(progressResult.value)
      if (activityResult.status === "fulfilled") setActivity(activityResult.value)
      if (phaseResult.status === "fulfilled") setPhaseProgress(phaseResult.value)
      if (reviewsResult.status === "fulfilled") setReviews(reviewsResult.value)
      if (weakResult.status === "fulfilled") setWeakTopics(weakResult.value)
      if (analyticsResult.status === "fulfilled") setAnalytics(analyticsResult.value)
      setLoaded(true)
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const allLessons = roadmap?.phases.flatMap((phase) => phase.lessons) ?? []
  const totalLessons = allLessons.length || roadmap?.totalLessons || 0
  const doneLessons = roadmap
    ? allLessons.filter((lesson) => progress[lesson.id]?.completed).length
    : gam.lessonsDone
  const nextLesson = chooseNextLesson({
    roadmap,
    progress,
    phaseProgress,
    passThreshold: LESSON_PASS_THRESHOLD,
  })
  const activity14 = buildDaySeries(activity, 14)
  const streakDays = buildStreakCalendar(activity)
  const weekMinutes = weekToDate(activity)
  const weakTopic = weakTopics[0]?.topic ?? analytics?.lowMastery[0] ?? null
  const firstReview = reviews[0]
  const reviewHref = firstReview
    ? `/roadmap/${firstReview.roadmapId}/lesson/${firstReview.lessonId}`
    : "/tutor"

  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <PageTransition>
            <DashboardHero
              greeting={greeting}
              firstName={user?.firstName ?? undefined}
              nextLesson={nextLesson}
              gam={gam}
              doneLessons={doneLessons}
              totalLessons={totalLessons}
              reviews={reviews}
              weakTopic={weakTopic}
              hasRoadmap={Boolean(roadmap)}
              hydrated={hydrated}
              loaded={loaded}
            />

            <motion.div
              variants={staggerParent}
              initial="hidden"
              animate="show"
              className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:grid-cols-2 xl:grid-cols-12"
            >
              <motion.div variants={staggerChild} className="xl:col-span-4">
                <RoadmapProgressWidget
                  roadmap={roadmap}
                  progress={progress}
                  phaseProgress={phaseProgress}
                  hydrated={hydrated}
                />
              </motion.div>

              <motion.div variants={staggerChild} className="xl:col-span-5">
                <ActivityWidget days={activity14} loaded={loaded} />
              </motion.div>

              <motion.div variants={staggerChild} className="sm:col-span-2 xl:col-span-3">
                <WeeklyGoalWidget weekMinutes={weekMinutes} loaded={loaded} />
              </motion.div>

              <motion.div variants={staggerChild} className="xl:col-span-5">
                <ReviewWidget
                  reviews={reviews}
                  weakTopics={weakTopics}
                  lowMastery={analytics?.lowMastery ?? []}
                  loaded={loaded}
                />
              </motion.div>

              <motion.div variants={staggerChild} className="xl:col-span-4">
                <MasteryWidget analytics={analytics} loaded={loaded} />
              </motion.div>

              <motion.div variants={staggerChild} className="sm:col-span-2 xl:col-span-3">
                <StreakCalendarWidget
                  days={streakDays}
                  streak={gam.streak}
                  bestStreak={gam.bestStreak}
                  loaded={loaded}
                />
              </motion.div>

              <motion.div variants={staggerChild} className="sm:col-span-2 xl:col-span-12">
                <QuickActionsWidget
                  reviewHref={reviewHref}
                  reviewCount={reviews.length}
                  loaded={loaded}
                />
              </motion.div>
            </motion.div>
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
