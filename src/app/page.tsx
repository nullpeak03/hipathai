import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Brain,
  Target,
  Zap,
  BarChart,
  Users,
  MessageSquare,
  ArrowRight,
  CheckCircle,
  Shield,
} from "lucide-react"

const features = [
  {
    icon: Brain,
    title: "Adaptive Roadmaps",
    description: "AI generates personalized learning paths that adapt based on your progress, weaknesses, and goals.",
  },
  {
    icon: Target,
    title: "Weakness Detection",
    description: "Automatically identifies knowledge gaps through quiz performance and adjusts your roadmap in real-time.",
  },
  {
    icon: Zap,
    title: "Smart Quiz Generation",
    description: "Multiple choice, code exercises, and short answer questions with adaptive difficulty and spaced repetition.",
  },
  {
    icon: MessageSquare,
    title: "AI Tutor",
    description: "Chat with an AI tutor that knows your roadmap, explains concepts, generates practice, and debugs code.",
  },
  {
    icon: BarChart,
    title: "Analytics Dashboard",
    description: "Weekly/monthly progress, knowledge gap heatmaps, benchmarks, and exportable reports.",
  },
  {
    icon: Users,
    title: "Collaborative Learning",
    description: "Study groups, shared roadmaps, real-time progress sync, and live group tutoring sessions.",
  },
]

const stats = [
  { label: "Roadmaps Generated", value: "10,000+" },
  { label: "Active Learners", value: "5,000+" },
  { label: "Quiz Questions", value: "50,000+" },
  { label: "Study Hours", value: "100,000+" },
]

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">HiPath AI</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              How It Works
            </Link>
            <Link href="#stats" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Stats
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm">Get Started Free</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <CheckCircle className="h-4 w-4" />
            <span>Completely Free • No Credit Card Required • Open Source</span>
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            Learn <span className="text-primary">Faster</span> with
            <br />
            AI-Powered Adaptive Roadmaps
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            HiPath AI creates personalized learning paths that adapt to your progress. 
            Identify weaknesses, practice with smart quizzes, and get 24/7 AI tutoring — all in one free platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2">
                Start Learning Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button size="lg" variant="outline">See How It Works</Button>
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Privacy First</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>No Lock-in</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Export Anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need to Master Any Skill</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for professionals upskilling and self-learners. Every feature designed to help you learn faster and retain more.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="h-full transition-shadow hover:shadow-lg">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Get Started in 3 Steps</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From signup to your first personalized roadmap in minutes.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Answer 6 Questions",
                description: "Tell us your role, goals, skill level, pace, preferred format, and topics. Takes 2 minutes.",
              },
              {
                step: "02",
                title: "Get Your Roadmap",
                description: "AI generates a complete roadmap with phases, modules, lessons, and quizzes tailored to you.",
              },
              {
                step: "03",
                title: "Learn & Adapt",
                description: "Take lessons, complete quizzes, chat with your AI tutor. Your roadmap adapts as you grow.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="text-4xl font-bold text-primary/20 mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Start Your Learning Journey?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of learners who are mastering new skills with HiPath AI. Free forever.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="gap-2">
              Create Free Account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold">HiPath AI</span>
              </div>
              <p className="text-muted-foreground text-sm">
                Adaptive learning platform for professionals and self-learners. 
                Generate personalized roadmaps, detect weaknesses, and master skills faster.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground">Roadmap Generator</Link></li>
                <li><Link href="#" className="hover:text-foreground">Weakness Detection</Link></li>
                <li><Link href="#" className="hover:text-foreground">Smart Quizzes</Link></li>
                <li><Link href="#" className="hover:text-foreground">AI Tutor</Link></li>
                <li><Link href="#" className="hover:text-foreground">Analytics</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground">About</Link></li>
                <li><Link href="#" className="hover:text-foreground">Blog</Link></li>
                <li><Link href="#" className="hover:text-foreground">Careers</Link></li>
                <li><Link href="#" className="hover:text-foreground">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:text-foreground">Terms of Service</Link></li>
                <li><Link href="#" className="hover:text-foreground">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 HiPath AI. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-muted-foreground hover:text-foreground">GitHub</a>
              <a href="#" className="text-muted-foreground hover:text-foreground">Twitter</a>
              <a href="#" className="text-muted-foreground hover:text-foreground">Discord</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}