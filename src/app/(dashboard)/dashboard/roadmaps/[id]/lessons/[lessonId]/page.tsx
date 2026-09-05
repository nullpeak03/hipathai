"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Play, 
  Check, 
  BookOpen, 
  Code, 
  Video, 
  FileText,
  ChevronLeft,
  ChevronRight,
  Star,
  Target,
  Clock
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface LessonContent {
  type: "video" | "article" | "interactive" | "mixed"
  videoUrl?: string
  articleContent?: string
  exercises?: Array<{
    id: string
    type: "code" | "multiple_choice" | "short_answer"
    prompt: string
    starterCode?: string
    solution?: string
    options?: string[]
    correctAnswer?: string
  }>
  resources?: Array<{ title: string; url: string; type: string }>
  summary?: string
  keyTakeaways?: string[]
}

interface Lesson {
  id: string
  title: string
  content_type: string
  content_data: LessonContent
  order_index: number
  estimated_minutes: number
  completed: boolean
  module_id?: string
}

interface Module {
  id: string
  title: string
  order_index: number
  lessons: Lesson[]
}

interface Phase {
  id: string
  title: string
  order_index: number
  modules: Module[]
}

export default function LessonPlayerPage() {
  const params = useParams()
  const router = useRouter()
  const roadmapId = params.id as string
  const lessonId = params.lessonId as string

  const [roadmap, setRoadmap] = useState<{ phases: Phase[] } | null>(null)
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null)
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0)
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0)
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("content")
  const [exerciseResults, setExerciseResults] = useState<Record<string, boolean>>({})
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizData, setQuizData] = useState<any>(null)
  const [isCompleting, setIsCompleting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchRoadmap()
  }, [roadmapId, lessonId])

  const fetchRoadmap = async () => {
    try {
      const { data, error } = await supabase
        .from("roadmaps")
        .select(`
          phases:roadmap_phases (
            id,
            title,
            order_index,
            modules:roadmap_modules (
              id,
              title,
              order_index,
              lessons (
                id,
                title,
                content_type,
                content_data,
                order_index,
                estimated_minutes,
                completed
              )
            )
          )
        `)
        .eq("id", roadmapId)
        .single()

      if (error) throw error

      // Sort phases, modules, lessons by order
      const sortedPhases = (data.phases || []).sort((a, b) => a.order_index - b.order_index).map(phase => ({
        ...phase,
        modules: (phase.modules || []).sort((a, b) => a.order_index - b.order_index).map(module => ({
          ...module,
          lessons: (module.lessons || []).sort((a, b) => a.order_index - b.order_index),
        })),
      }))

      setRoadmap({ phases: sortedPhases })

      // Find current lesson position
      let found = false
      sortedPhases.forEach((phase, pIdx) => {
        phase.modules.forEach((module, mIdx) => {
          module.lessons.forEach((lesson, lIdx) => {
            if (lesson.id === lessonId) {
              setCurrentLesson(lesson)
              setCurrentPhaseIndex(pIdx)
              setCurrentModuleIndex(mIdx)
              setCurrentLessonIndex(lIdx)
              found = true
            }
          })
        })
      })

      if (!found) {
        router.push(`/dashboard/roadmaps/${roadmapId}`)
      }
    } catch (error) {
      console.error("Failed to fetch roadmap:", error)
      router.push(`/dashboard/roadmaps/${roadmapId}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCompleteLesson = async () => {
    if (!currentLesson || isCompleting) return
    setIsCompleting(true)

    try {
      const { error } = await supabase
        .from("lessons")
        .update({ completed: true })
        .eq("id", currentLesson.id)

      if (error) throw error

      setCurrentLesson({ ...currentLesson, completed: true })
      
      // Navigate to next lesson or show completion
      const nextLesson = getNextLesson()
      if (nextLesson) {
        router.push(`/dashboard/roadmaps/${roadmapId}/lessons/${nextLesson.id}`)
      } else {
        router.push(`/dashboard/roadmaps/${roadmapId}`)
      }
    } catch (error) {
      console.error("Failed to complete lesson:", error)
    } finally {
      setIsCompleting(false)
    }
  }

  const getNextLesson = (): Lesson | null => {
    if (!roadmap) return null
    
    const phases = roadmap.phases
    for (let p = currentPhaseIndex; p < phases.length; p++) {
      const modules = phases[p].modules
      for (let m = (p === currentPhaseIndex ? currentModuleIndex : 0); m < modules.length; m++) {
        const lessons = modules[m].lessons
        for (let l = (p === currentPhaseIndex && m === currentModuleIndex ? currentLessonIndex + 1 : 0); l < lessons.length; l++) {
          if (!lessons[l].completed) {
            return lessons[l]
          }
        }
      }
    }
    return null
  }

  const getPrevLesson = (): Lesson | null => {
    if (!roadmap) return null
    
    const phases = roadmap.phases
    for (let p = currentPhaseIndex; p >= 0; p--) {
      const modules = phases[p].modules
      for (let m = (p === currentPhaseIndex ? currentModuleIndex : modules.length - 1); m >= 0; m--) {
        const lessons = modules[m].lessons
        for (let l = (p === currentPhaseIndex && m === currentModuleIndex ? currentLessonIndex - 1 : lessons.length - 1); l >= 0; l--) {
          return lessons[l]
        }
      }
    }
    return null
  }

  const handleExerciseSubmit = (exerciseId: string, isCorrect: boolean) => {
    setExerciseResults(prev => ({ ...prev, [exerciseId]: isCorrect }))
  }

  const renderContent = () => {
    if (!currentLesson) return null
    const content = currentLesson.content_data as LessonContent

    switch (currentLesson.content_type) {
      case "video":
        return (
          <div className="space-y-6">
            {content.videoUrl && (
              <div className="aspect-video rounded-lg bg-muted overflow-hidden">
                <iframe
                  src={content.videoUrl}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            {content.articleContent && (
              <div className="prose max-w-none">{content.articleContent}</div>
            )}
          </div>
        )

      case "article":
        return (
          <div className="prose max-w-none space-y-6">
            {content.articleContent && (
              <div dangerouslySetInnerHTML={{ __html: content.articleContent }} />
            )}
            {content.keyTakeaways && content.keyTakeaways.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4" /> Key Takeaways
                </h4>
                <ul className="space-y-1">
                  {content.keyTakeaways.map((takeaway, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-primary mt-0.5">→</span>
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {content.summary && (
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-semibold mb-2">Summary</h4>
                <p>{content.summary}</p>
              </div>
            )}
          </div>
        )

      case "interactive":
        return (
          <div className="space-y-6">
            {content.exercises && content.exercises.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Code className="h-5 w-5" /> Interactive Exercises
                </h3>
                <div className="space-y-4">
                  {content.exercises.map((exercise, idx) => (
                    <ExerciseCard
                      key={exercise.id || idx}
                      exercise={exercise}
                      index={idx}
                      result={exerciseResults[exercise.id || String(idx)]}
                      onSubmit={handleExerciseSubmit}
                    />
                  ))}
                </div>
              </div>
            )}
            {content.articleContent && (
              <div className="prose max-w-none">{content.articleContent}</div>
            )}
          </div>
        )

      case "mixed":
      default:
        return (
          <div className="space-y-6">
            {content.videoUrl && (
              <div className="aspect-video rounded-lg bg-muted overflow-hidden">
                <iframe
                  src={content.videoUrl}
                  className="w-full h-full"
                  frameBorder="0"
                  allowFullScreen
                />
              </div>
            )}
            {content.articleContent && (
              <div className="prose max-w-none">{content.articleContent}</div>
            )}
            {content.exercises && content.exercises.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Code className="h-5 w-5" /> Practice Exercises
                </h3>
                <div className="space-y-4">
                  {content.exercises.map((exercise, idx) => (
                    <ExerciseCard
                      key={exercise.id || idx}
                      exercise={exercise}
                      index={idx}
                      result={exerciseResults[exercise.id || String(idx)]}
                      onSubmit={handleExerciseSubmit}
                    />
                  ))}
                </div>
              </div>
            )}
            {content.keyTakeaways && content.keyTakeaways.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4" /> Key Takeaways
                </h4>
                <ul className="space-y-1">
                  {content.keyTakeaways.map((takeaway, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-primary mt-0.5">→</span>
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!currentLesson || !roadmap) {
    return null
  }

  const totalLessons = roadmap.phases.reduce((sum, p) => 
    sum + p.modules.reduce((mSum, m) => mSum + m.lessons.length, 0), 0
  )
  const completedLessons = roadmap.phases.reduce((sum, p) => 
    sum + p.modules.reduce((mSum, m) => mSum + m.lessons.filter(l => l.completed).length, 0), 0
  )
  const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  const prevLesson = getPrevLesson()
  const nextLesson = getNextLesson()

  return (
    <div className="min-h-screen bg-background">
      {/* Progress Header */}
      <div className="border-b bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/roadmaps/${roadmapId}`)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div>
                <p className="text-sm text-muted-foreground">Phase {currentPhaseIndex + 1} • Module {currentModuleIndex + 1}</p>
                <h1 className="font-semibold truncate max-w-[300px]">{currentLesson.title}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {currentLesson.estimated_minutes} min
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                Lesson {currentLessonIndex + 1}
              </span>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1 text-center">
            Overall Progress: {completedLessons}/{totalLessons} lessons ({progress}%)
          </p>
        </div>
      </div>

      {/* Lesson Content */}
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar - Curriculum */}
          <div className="lg:col-span-1 hidden lg:block">
            <Card className="sticky top-20 h-fit">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Course Content</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
                  {roadmap.phases.map((phase, pIdx) => (
                    <div key={phase.id} className="space-y-1">
                      <h4 className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Phase {phase.order_index}: {phase.title}
                      </h4>
                      {phase.modules.map((module, mIdx) => (
                        <div key={module.id} className="space-y-1 ml-2">
                          <p className="px-2 py-1 text-xs text-muted-foreground">{module.title}</p>
                          {module.lessons.map((lesson, lIdx) => {
                            const isCurrent = lesson.id === currentLesson.id
                            const isCompleted = lesson.completed
                            return (
                              <button
                                key={lesson.id}
                                onClick={() => router.push(`/dashboard/roadmaps/${roadmapId}/lessons/${lesson.id}`)}
                                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                                  isCurrent
                                    ? "bg-primary text-primary-foreground font-medium"
                                    : isCompleted
                                    ? "text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                                    : "hover:bg-muted"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {isCompleted ? (
                                    <Check className="h-3.5 w-3.5 text-green-500" />
                                  ) : isCurrent ? (
                                    <Play className="h-3.5 w-3.5 text-primary" />
                                  ) : (
                                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                  <span className="truncate">{lesson.title}</span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {currentLesson.content_type === "video" && <Video className="h-3 w-3" />}
                      {currentLesson.content_type === "article" && <FileText className="h-3 w-3" />}
                      {currentLesson.content_type === "interactive" && <Code className="h-3 w-3" />}
                      {currentLesson.content_type === "mixed" && <BookOpen className="h-3 w-3" />}
                      {currentLesson.content_type.charAt(0).toUpperCase() + currentLesson.content_type.slice(1)}
                    </span>
                  </div>
                  {currentLesson.completed && (
                    <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                      <Check className="h-3.5 w-3.5" />
                      Completed
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                    <TabsTrigger value="quiz">Quiz</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="content" className="pt-4">
                    {renderContent()}
                  </TabsContent>
                  
                  <TabsContent value="notes" className="pt-4">
                    <div className="border rounded-lg p-4 min-h-[200px]">
                      <p className="text-muted-foreground text-center py-8">
                        Personal notes feature coming soon
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="quiz" className="pt-4">
                    <QuizSection lessonId={currentLesson.id} onQuizComplete={handleCompleteLesson} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => prevLesson && router.push(`/dashboard/roadmaps/${roadmapId}/lessons/${prevLesson.id}`)}
                disabled={!prevLesson}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              
              <div className="flex items-center gap-2">
                {currentLesson.completed ? (
                  <Button 
                    onClick={() => nextLesson && router.push(`/dashboard/roadmaps/${roadmapId}/lessons/${nextLesson.id}`)}
                    disabled={!nextLesson}
                  >
                    Next Lesson
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button 
                    onClick={handleCompleteLesson} 
                    disabled={isCompleting}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Mark Complete
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ExerciseCardProps {
  exercise: {
    id?: string
    type: "code" | "multiple_choice" | "short_answer"
    prompt: string
    starterCode?: string
    solution?: string
    options?: string[]
    correctAnswer?: string
  }
  index: number
  result: boolean | undefined
  onSubmit: (exerciseId: string, isCorrect: boolean) => void
}

function ExerciseCard({ exercise, index, result, onSubmit }: ExerciseCardProps) {
  const [answer, setAnswer] = useState("")
  const [showSolution, setShowSolution] = useState(false)
  const exerciseId = exercise.id || `exercise-${index}`

  const handleSubmit = () => {
    let isCorrect = false
    if (exercise.type === "multiple_choice") {
      isCorrect = answer === exercise.correctAnswer
    } else if (exercise.type === "short_answer") {
      // Simple keyword matching for demo
      isCorrect = exercise.solution?.toLowerCase().includes(answer.toLowerCase()) || false
    } else {
      isCorrect = answer.trim().length > 0 // Code exercises - just check attempted
    }
    onSubmit(exerciseId, isCorrect)
  }

  if (exercise.type === "code") {
    return (
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Exercise {index + 1}: Code Practice</CardTitle>
            {result !== undefined && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${result ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {result ? "✓ Correct" : "✗ Try Again"}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{exercise.prompt}</p>
          <div className="relative">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              defaultValue={exercise.starterCode || ""}
              className="w-full h-48 font-mono text-sm p-3 rounded bg-muted border border-input resize-none"
              placeholder="Write your code here..."
              spellCheck={false}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={result !== undefined}>
              {result !== undefined ? "Submitted" : "Submit Answer"}
            </Button>
            <Button variant="outline" onClick={() => setShowSolution(!showSolution)}>
              {showSolution ? "Hide" : "Show"} Solution
            </Button>
          </div>
          {showSolution && exercise.solution && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3 text-sm font-mono">
              {exercise.solution}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (exercise.type === "multiple_choice") {
    return (
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Exercise {index + 1}: Multiple Choice</CardTitle>
            {result !== undefined && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${result ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {result ? "✓ Correct" : "✗ Try Again"}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{exercise.prompt}</p>
          <div className="space-y-2">
            {exercise.options?.map((option, optIdx) => (
              <button
                key={optIdx}
                onClick={() => setAnswer(option)}
                disabled={result !== undefined}
                className={`w-full text-left p-3 rounded border transition-colors ${
                  result !== undefined
                    ? option === exercise.correctAnswer
                      ? "bg-green-100 border-green-300 text-green-800"
                      : option === answer
                      ? "bg-red-100 border-red-300 text-red-800"
                      : "bg-muted"
                    : answer === option
                    ? "bg-primary/10 border-primary text-primary"
                    : "hover:bg-muted"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <Button onClick={handleSubmit} disabled={!answer || result !== undefined}>
            {result !== undefined ? "Submitted" : "Submit Answer"}
          </Button>
          {result !== undefined && exercise.solution && (
            <div className="text-sm text-muted-foreground">
              <strong>Explanation:</strong> {exercise.solution}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const resultBadge = result !== undefined ? (
      <span className={`text-xs font-medium px-2 py-0.5 rounded ${result ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
        {result ? "✓ Correct" : "✗ Try Again"}
      </span>
    ) : null

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Exercise {index + 1}: Short Answer</CardTitle>
          {resultBadge}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{exercise.prompt}</p>
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="w-full p-3 rounded border border-input bg-background"
          placeholder="Type your answer..."
          disabled={result !== undefined}
        />
        <Button onClick={handleSubmit} disabled={!answer.trim() || result !== undefined}>
          {result !== undefined ? "Submitted" : "Submit Answer"}
        </Button>
        {result !== undefined && exercise.solution && (
          <div className="text-sm text-muted-foreground">
            <strong>Expected:</strong> {exercise.solution}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface QuizSectionProps {
  lessonId: string
  onQuizComplete: () => void
}

function QuizSection({ lessonId, onQuizComplete }: QuizSectionProps) {
  const [quiz, setQuiz] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchQuiz = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/quizzes/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, difficulty: "adaptive" }),
      })
      const data = await response.json()
      if (data.success) {
        setQuiz(data.quiz)
      }
    } catch (error) {
      console.error("Failed to fetch quiz:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleQuizSubmit = async (answers: Record<string, string>) => {
    if (!quiz) return
    setSubmitting(true)
    try {
      const response = await fetch(`/api/quizzes/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quiz.id,
          answers,
          timeSpent: 300, // TODO: track actual time
        }),
      })
      const data = await response.json()
      if (data.success) {
        onQuizComplete()
      }
    } catch (error) {
      console.error("Failed to submit quiz:", error)
    } finally {
      setSubmitting(false)
    }
  }

  if (!quiz) {
    return (
      <div className="text-center py-12">
        <Button onClick={fetchQuiz} disabled={loading}>
          {loading ? "Generating Quiz..." : "Generate Quiz for This Lesson"}
        </Button>
        <p className="text-sm text-muted-foreground mt-2">
          This will create a personalized quiz based on the lesson content
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{quiz.title}</h3>
        <span className="text-sm text-muted-foreground">
          {quiz.questions.length} questions • {quiz.difficulty} difficulty
        </span>
      </div>
      <QuizPlayer quiz={quiz} onSubmit={handleQuizSubmit} submitting={submitting} />
    </div>
  )
}

function QuizPlayer({ quiz, onSubmit, submitting }: { quiz: any; onSubmit: (answers: Record<string, string>) => void; submitting: boolean }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showResults, setShowResults] = useState(false)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
  }

  const handleSubmit = () => {
    let correct = 0
    quiz.questions.forEach((q: any) => {
      if (answers[q.id] === q.correct_answer) correct++
    })
    const finalScore = Math.round((correct / quiz.questions.length) * 100)
    setScore(finalScore)
    setCorrectCount(correct)
    setShowResults(true)
    onSubmit(answers)
  }

  const handleNext = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  if (showResults) {
    return (
      <Card className="border-green-200 dark:border-green-800">
        <CardContent className="pt-6 text-center">
          <div className="mx-auto mb-4 w-24 h-24 rounded-full border-4 border-green-500 flex items-center justify-center">
            <span className="text-3xl font-bold text-green-600">{score}%</span>
          </div>
          <h3 className="text-2xl font-bold mb-2">
            {score >= 70 ? "Congratulations!" : "Keep Practicing!"}
          </h3>
          <p className="text-muted-foreground mb-6">
            You got {correctCount} out of {quiz.questions.length} questions correct.
          </p>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : "Complete Lesson"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const question = quiz.questions[currentQuestion]

  return (
    <div className="space-y-4">
      <Progress value={((currentQuestion + 1) / quiz.questions.length) * 100} className="mb-4" />
      
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              Question {currentQuestion + 1} of {quiz.questions.length}
            </span>
            <span className="text-sm font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
              {question.difficulty}
            </span>
          </div>
          
          <p className="text-lg font-medium mb-6">{question.prompt}</p>
          
          {question.type === "multiple_choice" && (
            <div className="space-y-2">
              {question.options.map((option: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(question.id, option)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    answers[question.id] === option
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-input hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                  {option}
                </button>
              ))}
            </div>
          )}
          
          {question.type === "short_answer" && (
            <input
              type="text"
              value={answers[question.id] || ""}
              onChange={(e) => handleAnswer(question.id, e.target.value)}
              className="w-full p-4 rounded-lg border border-input bg-background text-lg"
              placeholder="Type your answer..."
            />
          )}
          
          {question.type === "code" && (
            <textarea
              value={answers[question.id] || ""}
              onChange={(e) => handleAnswer(question.id, e.target.value)}
              className="w-full h-64 font-mono p-4 rounded-lg border border-input bg-background"
              placeholder="Write your code here..."
              spellCheck={false}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handlePrev} disabled={currentQuestion === 0}>
          Previous
        </Button>
        <div className="flex items-center gap-2">
          {currentQuestion === quiz.questions.length - 1 ? (
            <Button onClick={handleSubmit} disabled={!answers[question.id] || submitting}>
              {submitting ? "Submitting..." : "Submit Quiz"}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!answers[question.id]}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}