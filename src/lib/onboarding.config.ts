export type OnboardingOption = { value: string; label: string; desc?: string }

export type OnboardingStep = {
  id: "goal" | "level" | "time" | "duration" | "why" | "style"
  title: string
  subtitle: string
  type: "text+chips" | "segmented" | "segmented+custom" | "grid"
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
    type: "grid",
    options: [
      { value: "Career Switch", label: "Career Switch" },
      { value: "Upskilling", label: "Upskilling" },
      { value: "Exam Prep", label: "Exam Prep" },
      { value: "Build Project", label: "Build Project" },
      { value: "Freelance", label: "Freelance" },
      { value: "Hobby", label: "Hobby" },
    ]
  },
  {
    id: "style",
    title: "Preferred learning style?",
    subtitle: "Your mentor will adapt explanations to this.",
    type: "grid",
    options: [
      { value: "Visual", label: "Visual", desc: "Diagrams, videos" },
      { value: "Hands-on", label: "Hands-on", desc: "Code & projects" },
      { value: "Theory", label: "Theory", desc: "Concepts first" },
      { value: "Mixed", label: "Mixed", desc: "Best of all" },
    ]
  },
]

export function parseTimeToMinutes(time: string): number {
  if (time.includes("30")) return 30
  if (time.includes("1 hr")) return 60
  if (time.includes("2 hr")) return 120
  const m = parseInt(time)
  return isNaN(m) ? 60 : m
}
export function parseDurationToDays(duration: string): number {
  const w = parseInt(duration)
  if (duration.includes("week")) return (isNaN(w) ? 8 : w) * 7
  if (duration.includes("day")) return isNaN(w) ? 56 : w
  return 56
}
