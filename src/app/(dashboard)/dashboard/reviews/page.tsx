"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  Brain, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  Clock,
  Star,
  TrendingUp,
  BookOpen,
  ArrowLeft,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

interface ReviewItem {
  id: string
  concept: string
  masteryLevel: number
  totalAttempts: number
  correctAttempts: number
  lastReviewed: string
  nextReview: string
  lessonTitle: string
  roadmapTitle: string
  question: {
    id: string
    prompt: string
    type: string
    correct_answer: string
    explanation: string
    difficulty: string
    options: string[] | null
  }
}

interface ReviewSession {
  reviews: ReviewItem[]
  currentIndex: number
  answers: Record<string, string>
  results: Record<string, { correct: boolean; newMastery: number }>
  isSubmitting: boolean
  showResults: boolean
}

export default function ReviewsPage() {
  const [dueReviews, setDueReviews] = useState<ReviewItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [session, setSession] = useState<ReviewSession | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchDueReviews()
  }, [])

  const fetchDueReviews = async () => {
    try {
      const response = await fetch("/api/reviews/due")
      const data = await response.json()
      if (data.success) {
        setDueReviews(data.reviews)
      } else {
        setError(data.error || "Failed to fetch reviews")
      }
    } catch (err) {
      setError("Failed to fetch reviews")
    } finally {
      setIsLoading(false)
    }
  }

  const startSession = () => {
    if (dueReviews.length > 0) {
      setSession({
        reviews: dueReviews,
        currentIndex: 0,
        answers: {},
        results: {},
        isSubmitting: false,
        showResults: false,
      })
    }
  }

  const handleAnswer = (reviewId: string, answer: string) => {
    setSession(prev => prev ? {
      ...prev,
      answers: { ...prev.answers, [reviewId]: answer },
    } : null)
  }

  const handleSubmit = async () => {
    if (!session) return
    const currentReview = session.reviews[session.currentIndex]
    const answer = session.answers[currentReview.id]

    if (!answer) return

    setSession(prev => prev ? { ...prev, isSubmitting: true } : null)

    try {
      const response = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptId: currentReview.id,
          answer,
          timeSpent: 60, // TODO: track actual time
        }),
      })

      const data = await response.json()
      if (data.success) {
        setSession(prev => {
          if (!prev) return null
          const nextIndex = prev.currentIndex + 1
          return {
            ...prev,
            isSubmitting: false,
            results: {
              ...prev.results,
              [currentReview.id]: {
                correct: data.isCorrect,
                newMastery: data.newMasteryLevel,
              },
            },
            currentIndex: nextIndex,
            showResults: nextIndex >= prev.reviews.length,
          }
        })
      }
    } catch (err) {
      console.error("Submit review error:", err)
      setSession(prev => prev ? { ...prev, isSubmitting: false } : null)
    }
  }

  const handleNext = () => {
    setSession(prev => {
      if (!prev) return null
      if (prev.currentIndex < prev.reviews.length - 1) {
        return { ...prev, currentIndex: prev.currentIndex + 1 }
      }
      return { ...prev, showResults: true }
    })
  }

  const handlePrev = () => {
    setSession(prev => {
      if (!prev) return null
      if (prev.currentIndex > 0) {
        return { ...prev, currentIndex: prev.currentIndex - 1 }
      }
      return prev
    })
  }

  const handleRestart = () => {
    fetchDueReviews()
    setSession(null)
  }

  const getMasteryColor = (level: number) => {
    if (level >= 80) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    if (level >= 60) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-muted rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              Spaced Repetition Review
            </h1>
            <p className="text-muted-foreground">
              Review concepts that are due for reinforcement
            </p>
          </div>
        </div>

        {error && (
          <Card className="border-destructive/20">
            <CardContent className="text-destructive p-4">{error}</CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Due for Review</p>
                  <p className="text-3xl font-bold">{dueReviews.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Mastery</p>
                  <p className="text-3xl font-bold">
                    {dueReviews.length > 0
                      ? Math.round(dueReviews.reduce((sum, r) => sum + r.masteryLevel, 0) / dueReviews.length)
                      : 0}%
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Attempts</p>
                  <p className="text-3xl font-bold">
                    {dueReviews.reduce((sum, r) => sum + r.totalAttempts, 0)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Star className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reviews List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Concepts Due for Review ({dueReviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dueReviews.length === 0 ? (
              <div className="text-center py-12">
                <Brain className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
                <p className="text-muted-foreground mb-6">
                  No concepts are due for review right now. Great job staying on top of your learning!
                </p>
                <Button variant="outline" onClick={fetchDueReviews}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-6">
                  {dueReviews.map((review, idx) => (
                    <div key={review.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-medium">{review.concept}</p>
                          <p className="text-sm text-muted-foreground">
                            {review.lessonTitle} • {review.roadmapTitle}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={getMasteryColor(review.masteryLevel)}>
                          {review.masteryLevel}% Mastery
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Due {formatDistanceToNow(new Date(review.nextReview), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <Button onClick={startSession} className="w-full gap-2" size="lg">
                  <Brain className="h-4 w-4" />
                  Start Review Session ({dueReviews.length} concepts)
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Review Session View
  const currentReview = session.reviews[session.currentIndex]
  const currentResult = session.results[currentReview.id]
  const progress = ((session.currentIndex + 1) / session.reviews.length) * 100

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/reviews" className="p-2 hover:bg-muted rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              Review Session
            </h1>
            <p className="text-muted-foreground">
              Question {session.currentIndex + 1} of {session.reviews.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Progress value={progress} className="w-48" />
          <span className="text-sm font-medium">{Math.round(progress)}%</span>
        </div>
      </div>

      {session.showResults ? (
        // Results Summary
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="w-24 h-24 mx-auto rounded-full border-4 border-green-500 flex items-center justify-center mb-4">
              <span className="text-3xl font-bold text-green-600">
                {Math.round(
                  Object.values(session.results).filter(r => r.correct).length / session.reviews.length * 100
                )}%
              </span>
            </div>
            <h3 className="text-2xl font-bold mb-2">Session Complete!</h3>
            <p className="text-muted-foreground mb-6">
              You reviewed {session.reviews.length} concepts.
              {Object.values(session.results).filter(r => r.correct).length} correct,
              {Object.values(session.results).filter(r => !r.correct).length} to revisit.
            </p>
            <div className="space-y-2 mb-6 max-w-md mx-auto text-left">
              {session.reviews.map((review) => {
                const result = session.results[review.id]
                return (
                  <div key={review.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">{review.concept}</span>
                    <Badge className={result?.correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                      {result?.correct ? "✓ Mastered" : "✗ Needs Review"} ({result?.newMastery}%)
                    </Badge>
                  </div>
                )
              })}
            </div>
            <Button onClick={handleRestart} className="w-full max-w-xs mx-auto gap-2">
              <RefreshCw className="h-4 w-4" />
              Review Again
            </Button>
          </CardContent>
        </Card>
      ) : (
        // Review Question
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="gap-1">
                <BookOpen className="h-3 w-3" />
                {currentReview.lessonTitle}
              </Badge>
              <Badge variant="outline" className={getMasteryColor(currentReview.masteryLevel)}>
                {currentReview.masteryLevel}% Mastery
              </Badge>
            </div>
            <CardTitle className="mt-2">{currentReview.concept}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-lg font-medium">{currentReview.question.prompt}</p>
            </div>

            {currentResult && (
              <div className={`p-4 rounded-lg ${currentResult.correct ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {currentResult.correct ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-medium">
                    {currentResult.correct ? "Correct!" : "Not quite right"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{currentReview.question.explanation}</p>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    Mastery: {currentResult.newMastery}%
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Next review in {Math.ceil((new Date(currentReview.nextReview).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                  </span>
                </div>
              </div>
            )}

            {!currentResult && (
              <>
                {currentReview.question.type === "multiple_choice" && currentReview.question.options && (
                  <div className="space-y-2">
                    {currentReview.question.options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAnswer(currentReview.id, option)}
                        disabled={session.isSubmitting}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                          session.answers[currentReview.id] === option
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

                {currentReview.question.type === "short_answer" && (
                  <input
                    type="text"
                    value={session.answers[currentReview.id] || ""}
                    onChange={(e) => handleAnswer(currentReview.id, e.target.value)}
                    className="w-full p-4 rounded-lg border border-input bg-background text-lg"
                    placeholder="Type your answer..."
                    disabled={session.isSubmitting}
                  />
                )}

                {currentReview.question.type === "code" && (
                  <textarea
                    value={session.answers[currentReview.id] || ""}
                    onChange={(e) => handleAnswer(currentReview.id, e.target.value)}
                    className="w-full h-64 font-mono p-4 rounded-lg border border-input bg-background"
                    placeholder="Write your code here..."
                    spellCheck={false}
                    disabled={session.isSubmitting}
                  />
                )}
              </>
            )}

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={session.currentIndex === 0 || session.isSubmitting}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center gap-2">
                {session.currentIndex === session.reviews.length - 1 ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={!session.answers[currentReview.id] || session.isSubmitting}
                  >
                    {session.isSubmitting ? "Submitting..." : "Finish Review"}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    disabled={!session.answers[currentReview.id]}
                  >
                    Next
                    <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}