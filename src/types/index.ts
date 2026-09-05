// Application Types

export type UserRole = "student" | "professional" | "self-learner" | "career-changer"
export type SkillLevel = "beginner" | "intermediate" | "advanced"
export type ContentFormat = "video" | "text" | "interactive" | "mixed"
export type LearningPace = "light" | "moderate" | "intensive"
export type RoadmapStatus = "draft" | "active" | "completed" | "archived"
export type LessonType = "video" | "article" | "interactive" | "quiz" | "project"
export type QuizType = "multiple-choice" | "code" | "short-answer"
export type QuizDifficulty = "easy" | "medium" | "hard"
export type Theme = "light" | "dark" | "system"

export interface OnboardingData {
  currentRole: string
  careerGoal: string
  learningObjective: string
  skillLevel: SkillLevel
  hoursPerWeek: LearningPace
  contentFormat: ContentFormat
  topicsOfInterest: string[]
}

export interface Roadmap {
  id: string
  userId: string
  title: string
  topic: string
  description: string
  status: RoadmapStatus
  currentPhase: number
  version: number
  parentRoadmapId: string | null
  createdAt: string
  updatedAt: string
  phases?: RoadmapPhase[]
}

export interface RoadmapPhase {
  id: string
  roadmapId: string
  title: string
  description: string
  order: number
  estimatedHours: number
  modules?: RoadmapModule[]
}

export interface RoadmapModule {
  id: string
  phaseId: string
  title: string
  description: string
  order: number
  estimatedMinutes: number
  lessons?: Lesson[]
}

export interface Lesson {
  id: string
  moduleId: string
  title: string
  contentType: LessonType
  contentData: Record<string, unknown>
  order: number
  estimatedMinutes: number
  quiz?: Quiz
  progress?: LessonProgress
}

export interface LessonProgress {
  id: string
  userId: string
  lessonId: string
  completed: boolean
  timeSpent: number
  lastPosition: number
  completedAt: string | null
}

export interface Quiz {
  id: string
  lessonId: string
  type: QuizType
  difficulty: QuizDifficulty
  spacedRepetitionData?: SpacedRepetitionData
  questions?: Question[]
}

export interface Question {
  id: string
  quizId: string
  type: QuizType
  prompt: string
  options?: string[]
  correctAnswer: string
  explanation?: string
  difficulty: QuizDifficulty
  conceptTags: string[]
}

export interface SpacedRepetitionData {
  interval: number
  easeFactor: number
  nextReview: string
  repetitions: number
}

export interface QuizAttempt {
  id: string
  userId: string
  quizId: string
  score: number
  answers: Record<string, string>
  timeSpent: number
  completedAt: string
  weaknessAnalysis?: WeaknessAnalysis
}

export interface WeaknessAnalysis {
  weakConcepts: string[]
  strongConcepts: string[]
  recommendedReview: string[]
  adaptationTriggered: boolean
}

export interface ChatSession {
  id: string
  userId: string
  roadmapId?: string
  lessonId?: string
  title: string
  createdAt: string
  messages?: ChatMessage[]
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  toolCalls?: ToolCall[]
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
}

export interface StudySession {
  id: string
  userId: string
  roadmapId?: string
  lessonId?: string
  duration: number
  activityType: "lesson" | "quiz" | "review" | "ai-tutor" | "reading"
  createdAt: string
}

export interface UserConcept {
  id: string
  userId: string
  concept: string
  masteryLevel: number
  lastReviewed: string
  nextReview: string
  totalAttempts: number
  correctAttempts: number
}

export interface StudyGroup {
  id: string
  name: string
  description: string
  ownerId: string
  inviteCode: string
  createdAt: string
  members?: GroupMember[]
}

export interface GroupMember {
  id: string
  groupId: string
  userId: string
  role: "owner" | "admin" | "member"
  joinedAt: string
}

export interface SharedRoadmap {
  id: string
  groupId: string
  roadmapId: string
  permission: "view" | "edit" | "admin"
  sharedAt: string
}

export interface Notification {
  id: string
  userId: string
  type: "reminder" | "streak" | "group-invite" | "group-activity" | "achievement" | "review-due"
  title: string
  message: string
  data?: Record<string, unknown>
  read: boolean
  createdAt: string
}

export interface AnalyticsDashboard {
  weekly: WeeklyAnalytics
  monthly: MonthlyAnalytics
  knowledgeGaps: KnowledgeGap[]
  benchmarks: BenchmarkData
}

export interface WeeklyAnalytics {
  weekStart: string
  totalHours: number
  lessonsCompleted: number
  quizzesTaken: number
  averageScore: number
  streak: number
  dailyBreakdown: DailyStat[]
}

export interface MonthlyAnalytics {
  month: string
  totalHours: number
  lessonsCompleted: number
  quizzesTaken: number
  averageScore: number
  streak: number
  weeklyBreakdown: WeeklyStat[]
}

export interface DailyStat {
  date: string
  hours: number
  lessonsCompleted: number
  quizzesTaken: number
}

export interface WeeklyStat {
  weekStart: string
  hours: number
  lessonsCompleted: number
  quizzesTaken: number
}

export interface KnowledgeGap {
  concept: string
  masteryLevel: number
  totalAttempts: number
  correctAttempts: number
  lastReviewed: string
  nextReview: string
  priority: "high" | "medium" | "low"
}

export interface BenchmarkData {
  personalBest: {
    streak: number
    weeklyHours: number
    monthlyLessons: number
  }
  averages: {
    dailyHours: number
    weeklyLessons: number
    quizAccuracy: number
  }
}

export interface UserProfile {
  id: string
  clerkId: string
  username: string | null
  avatarUrl: string | null
  theme: Theme
  timezone: string
  learningGoals: string[]
  preferences: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface OnboardingResponse {
  id: string
  userId: string
  currentRole: string
  careerGoal: string
  learningObjective: string
  skillLevel: SkillLevel
  hoursPerWeek: LearningPace
  contentFormat: ContentFormat
  topicsOfInterest: string[]
  completedAt: string
  generatedRoadmapId: string | null
}