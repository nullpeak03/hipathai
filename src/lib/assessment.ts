import type { QuizQuestion } from "./mockData"

export type PublicQuizQuestion = Omit<QuizQuestion, "correct">
export type AssessmentMode = "standard" | "remedial" | "challenge" | "phase"
export type IssuedAssessment = {
  assessmentId: string
  quiz: PublicQuizQuestion[]
}
export type AssessmentResult = {
  assessmentId: string
  score: number
  passed: boolean
  mastered: boolean
  results: { correct: boolean; explanation: string }[]
}

export function publicQuizQuestions(questions: QuizQuestion[]): PublicQuizQuestion[] {
  return questions.map((question) => {
    const publicQuestion: PublicQuizQuestion = {
      q: question.q,
      options: question.options,
      explanation: question.explanation,
    }
    if (question.difficulty !== undefined) publicQuestion.difficulty = question.difficulty
    return publicQuestion
  })
}
