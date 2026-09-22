export type OnboardingOption = { value: string; label: string; desc?: string }

export type OnboardingStep = {
  id: "goal" | "level" | "time" | "duration" | "why" | "style"
  title: string
  subtitle: string
  type: "text+chips" | "segmented" | "segmented+custom" | "grid" | "grid+custom"
  /** When true, options toggle as a multi-select (comma-joined value). */
  multi?: boolean
  options?: OnboardingOption[]
  placeholder?: string
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "goal",
    title: "What do you want to learn?",
    subtitle: "Turn any goal into a structured roadmap. Be specific for better results.",
    type: "text+chips",
    placeholder: "e.g., Become AI Agent developer with Python, Master DSA in 8 weeks",
    options: [
      { value: "AI Agent Developer", label: "AI Agent Developer" },
      { value: "Full Stack Web Development", label: "Full Stack Web Dev" },
      { value: "Data Structures & Algorithms", label: "DSA" },
      { value: "Machine Learning Fundamentals", label: "Machine Learning" },
      { value: "System Design", label: "System Design" },
      { value: "Cloud & DevOps", label: "Cloud & DevOps" },
    ]
  },
  {
    id: "level",
    title: "Your current level?",
    subtitle: "This helps us calibrate depth and pace.",
    type: "segmented",
    options: [
      { value: "Beginner", label: "Beginner", desc: "Just starting" },
      { value: "Intermediate", label: "Intermediate", desc: "Built projects before" },
      { value: "Advanced", label: "Advanced", desc: "Deepen expertise" },
    ]
  },
  {
    id: "time",
    title: "Time per day?",
    subtitle: "We’ll shape daily lessons to fit your schedule.",
    type: "segmented+custom",
    options: [
      { value: "30 min", label: "30 min" },
      { value: "1 hr", label: "1 hr / day" },
      { value: "2 hrs", label: "2 hrs / day" },
      { value: "Custom", label: "Custom" },
    ]
  },
  {
    id: "duration",
    title: "How long to reach your goal?",
    subtitle: "Set a timeframe — we’ll adapt if you go faster or slower.",
    type: "segmented+custom",
    options: [
      { value: "2 weeks", label: "2 weeks" },
      { value: "4 weeks", label: "4 weeks" },
      { value: "8 weeks", label: "8 weeks" },
      { value: "12 weeks", label: "12 weeks" },
      { value: "Custom", label: "Custom" },
    ]
  },
  {
    id: "why",
    title: "Why are you learning?",
    subtitle: "Motivation shapes your roadmap and mentor style.",
    type: "grid+custom",
    options: [
      { value: "Career Switch", label: "Career Switch" },
      { value: "Upskilling", label: "Upskilling" },
      { value: "Exam Prep", label: "Exam Prep" },
      { value: "Build Project", label: "Build Project" },
      { value: "Freelance", label: "Freelance" },
      { value: "Hobby", label: "Hobby" },
      { value: "Custom", label: "Custom" },
    ]
  },
  {
    id: "style",
    title: "Preferred learning style?",
    subtitle: "Pick all that fit — your roadmap blends them. Your mentor adapts too.",
    type: "grid",
    multi: true,
    options: [
      { value: "Visual", label: "Visual", desc: "Diagrams, videos" },
      { value: "Hands-on", label: "Hands-on", desc: "Code & projects" },
      { value: "Theory", label: "Theory", desc: "Concepts first" },
      { value: "Mixed", label: "Mixed", desc: "Balanced blend" },
      { value: "Project-Based", label: "Project-Based", desc: "Learn by building" },
      { value: "Socratic", label: "Socratic", desc: "Tutor-led dialogue" },
      { value: "Reading & Research", label: "Reading", desc: "Docs & sources" },
    ]
  },
]

// Canonical time/duration parsers live in roadmap-sizing (single source).
export { parseTimeToMinutes, parseDurationToDays } from "./roadmap-sizing"
