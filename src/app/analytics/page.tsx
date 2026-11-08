"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { PageTransition } from "@/components/motion/page-transition"
import { AnalyticsHero } from "@/components/analytics/analytics-hero"
import { AnalyticsKpiRow } from "@/components/analytics/kpi-row"
import { ActivityConsistencyWidget } from "@/components/analytics/activity-consistency-widget"
import { StudyTrendWidget } from "@/components/analytics/study-trend-widget"
import { MasteryBreakdownWidget } from "@/components/analytics/mastery-breakdown-widget"
import { WeakSkillsWidget } from "@/components/analytics/weak-skills-widget"
import { RoadmapPhaseWidget } from "@/components/analytics/roadmap-phase-widget"
import { XpProgressWidget } from "@/components/analytics/xp-progress-widget"
import { AnalyticsRangeToggle } from "@/components/analytics/range-toggle"
import { AnalyticsSkeleton } from "@/components/analytics/analytics-skeleton"
import { chooseNextLesson } from "@/lib/daily-priority"
import {
  buildCoachingInsight,
  compareWeekToDate,
  rankWeakSkills,
  summarizeMastery,
  summarizeRange,
  summarizeRoadmap,
  summarizeXp,
  type AnalyticsRange,
} from "@/lib/analytics-insights"
import { staggerChild, staggerParent } from "@/lib/motion"
import { LESSON_PASS_THRESHOLD } from "@/lib/v2-mastery"
import {
  FRESH_GAM,
  loadDailyActivity,
  loadGam,
  loadGamAsync,
  loadLearningAnalytics,
  loadMasteryAsync,
  loadPhaseProgress,
  loadProgress,
  loadProgressAsync,
  loadRoadmap,
  loadRoadmapAsync,
  loadWeakTopics,
  type ActivityDay,
  type Gamification,
  type LearningAnalytics,
  type MasteryRecord,
  type PhaseProgress,
  type Progress,
  type RoadmapData,
  type WeakTopic,
} from "@/lib/store"

export default function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>(30)
  const [gam, setGam] = useState<Gamification>(FRESH_GAM)
  const [activity, setActivity] = useState<ActivityDay[]>([])
  const [learning, setLearning] = useState<LearningAnalytics | null>(null)
  const [masteryRecords, setMasteryRecords] = useState<MasteryRecord[]>([])
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([])
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null)
  const [progress, setProgress] = useState<Progress>({})
  const [phaseProgress, setPhaseProgress] = useState<PhaseProgress>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Paint cached values immediately, then reconcile once with the server.
    setGam(loadGam())
    setRoadmap(loadRoadmap())
    setProgress(loadProgress())

    let cancelled = false
    void Promise.allSettled([
      loadGamAsync(),
      loadDailyActivity(90),
      loadLearningAnalytics(),
      loadMasteryAsync(),
      loadWeakTopics(),
      loadRoadmapAsync(),
      loadProgressAsync(),
      loadPhaseProgress(),
    ]).then((results) => {
      if (cancelled) return
      const [gamResult, activityResult, learningResult, masteryResult, weakResult, roadmapResult, progressResult, phaseResult] =
        results

      if (gamResult.status === "fulfilled") setGam(gamResult.value)
      if (activityResult.status === "fulfilled") setActivity(activityResult.value)
      if (learningResult.status === "fulfilled") setLearning(learningResult.value)
      if (masteryResult.status === "fulfilled") setMasteryRecords(masteryResult.value)
      if (weakResult.status === "fulfilled") setWeakTopics(weakResult.value)
      if (roadmapResult.status === "fulfilled" && roadmapResult.value) setRoadmap(roadmapResult.value)
      if (progressResult.status === "fulfilled") setProgress(progressResult.value)
      if (phaseResult.status === "fulfilled") setPhaseProgress(phaseResult.value)
      setLoaded(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const summary = useMemo(() => summarizeRange(activity, range), [activity, range])
  const mastery = useMemo(() => summarizeMastery(masteryRecords, learning), [masteryRecords, learning])
  const weakSkills = useMemo(
    () => rankWeakSkills(mastery.topics, weakTopics, learning?.lowMastery ?? []),
    [mastery.topics, weakTopics, learning]
  )
  const roadmapSummary = useMemo(
    () => summarizeRoadmap(roadmap, progress, phaseProgress),
    [roadmap, progress, phaseProgress]
  )
  const nextLesson = useMemo(
    () =>
      chooseNextLesson({
        roadmap,
        progress,
        phaseProgress,
        passThreshold: LESSON_PASS_THRESHOLD,
      }),
    [roadmap, progress, phaseProgress]
  )
  const insight = useMemo(
    () =>
      buildCoachingInsight({
        summary,
        gam,
        mastery,
        weakSkills,
        nextLesson,
        hasRoadmap: Boolean(roadmap),
      }),
    [summary, gam, mastery, weakSkills, nextLesson, roadmap]
  )
  const week = useMemo(() => compareWeekToDate(activity), [activity])
  const xp = useMemo(() => summarizeXp(gam, summary.days), [gam, summary.days])

  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Dashboard &gt; Analytics</div>
              <h1 className="t-title mt-1 text-2xl sm:text-3xl">Analytics</h1>
              <p className="t-caption mt-1">What your study data says — and what to do next.</p>
            </div>
            <AnalyticsRangeToggle value={range} onChange={setRange} />
          </div>

          <PageTransition>
            {!loaded ? (
              <AnalyticsSkeleton />
            ) : (
              <motion.div
                variants={staggerParent}
                initial="hidden"
                animate="show"
                className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:grid-cols-2 xl:grid-cols-12"
              >
                <motion.div variants={staggerChild} className="sm:col-span-2 xl:col-span-12">
                  <AnalyticsHero insight={insight} />
                </motion.div>

                <motion.div variants={staggerChild} className="sm:col-span-2 xl:col-span-12">
                  <AnalyticsKpiRow gam={gam} summary={summary} mastery={mastery} />
                </motion.div>

                <motion.div variants={staggerChild} className="sm:col-span-2 xl:col-span-7">
                  <ActivityConsistencyWidget
                    summary={summary}
                    streak={gam.streak}
                    bestStreak={gam.bestStreak}
                  />
                </motion.div>

                <motion.div variants={staggerChild} className="sm:col-span-2 xl:col-span-5">
                  <StudyTrendWidget summary={summary} week={week} />
                </motion.div>

                <motion.div variants={staggerChild} className="sm:col-span-2 xl:col-span-5">
                  <MasteryBreakdownWidget mastery={mastery} />
                </motion.div>

                <motion.div variants={staggerChild} className="sm:col-span-2 xl:col-span-4">
                  <WeakSkillsWidget weakSkills={weakSkills} hasMastery={mastery.hasData} />
                </motion.div>

                <motion.div variants={staggerChild} className="sm:col-span-2 xl:col-span-3">
                  <RoadmapPhaseWidget summary={roadmapSummary} nextLesson={nextLesson} />
                </motion.div>

                <motion.div variants={staggerChild} className="sm:col-span-2 xl:col-span-12">
                  <XpProgressWidget gam={gam} summary={summary} xp={xp} />
                </motion.div>
              </motion.div>
            )}
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
