import type { SupabaseClient } from "@supabase/supabase-js"
import type { QuizQuestion } from "./mockData"
import { publicQuizQuestions, type AssessmentMode } from "./assessment"

export async function lessonIsUnlocked(supabase: SupabaseClient, userId: string, lessonId: string): Promise<boolean> {
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id,roadmap_id,phase_id,idx,prerequisites")
    .eq("id", lessonId)
    .single()
  if (!lesson) return false

  const prerequisites = Array.isArray(lesson.prerequisites) ? lesson.prerequisites as string[] : []
  if (prerequisites.length > 0) {
    const { data: passed } = await supabase
      .from("progress")
      .select("lesson_id")
      .eq("user_id", userId)
      .eq("passed", true)
      .in("lesson_id", prerequisites)
    return (passed?.length ?? 0) === prerequisites.length
  }

  const { data: previousLesson } = await supabase
    .from("lessons")
    .select("id")
    .eq("phase_id", lesson.phase_id)
    .lt("idx", lesson.idx)
    .order("idx", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (previousLesson) {
    const { data: progress } = await supabase
      .from("progress")
      .select("passed")
      .eq("user_id", userId)
      .eq("lesson_id", previousLesson.id)
      .maybeSingle()
    return progress?.passed === true
  }

  const { data: phase } = await supabase
    .from("phases")
    .select("idx")
    .eq("id", lesson.phase_id)
    .single()
  if (!phase) return false
  const { data: previousPhase } = await supabase
    .from("phases")
    .select("id")
    .eq("roadmap_id", lesson.roadmap_id)
    .lt("idx", phase.idx)
    .order("idx", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!previousPhase) return true

  const { data: previousLessons } = await supabase
    .from("lessons")
    .select("id")
    .eq("phase_id", previousPhase.id)
  const previousIds = (previousLessons ?? []).map((row) => row.id as string)
  if (previousIds.length === 0) return true
  const { data: previousProgress } = await supabase
    .from("progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .eq("passed", true)
    .in("lesson_id", previousIds)
  if ((previousProgress?.length ?? 0) !== previousIds.length) return false

  const { data: phaseProgress } = await supabase
    .from("phase_exam_progress")
    .select("passed,attempts")
    .eq("user_id", userId)
    .eq("phase_id", previousPhase.id)
    .maybeSingle()
  return phaseProgress?.passed === true || (phaseProgress?.attempts ?? 0) >= 2
}

export async function issueAssessment(
  supabase: SupabaseClient,
  userId: string,
  target: { lessonId: string } | { phaseId: string },
  mode: AssessmentMode,
  questions: QuizQuestion[]
) {
  const { data, error } = await supabase
    .from("quiz_assessments")
    .insert({
      user_id: userId,
      lesson_id: "lessonId" in target ? target.lessonId : null,
      phase_id: "phaseId" in target ? target.phaseId : null,
      mode,
      questions,
    })
    .select("id")
    .single()

  if (error || !data) {
    throw new Error("Could not issue assessment")
  }
  return { assessmentId: data.id as string, quiz: publicQuizQuestions(questions) }
}
