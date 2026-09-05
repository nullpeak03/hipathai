import { NextResponse } from "next/server"

const onboardingQuestions = [
  {
    id: "currentRole",
    label: "What's your current role?",
    type: "select",
    placeholder: "Select your role",
    required: true,
    options: [
      { value: "software-engineer", label: "Software Engineer" },
      { value: "data-scientist", label: "Data Scientist" },
      { value: "designer", label: "Designer" },
      { value: "product-manager", label: "Product Manager" },
      { value: "student", label: "Student" },
      { value: "career-changer", label: "Career Changer" },
      { value: "other", label: "Other" },
    ],
  },
  {
    id: "careerGoal",
    label: "What's your career goal?",
    type: "text",
    placeholder: "e.g., Become a Senior Full-Stack Engineer",
    required: true,
    maxLength: 200,
  },
  {
    id: "learningObjective",
    label: "What's your primary learning objective?",
    type: "select",
    placeholder: "Select your objective",
    required: true,
    options: [
      { value: "master-new-technology", label: "Master a new technology/framework" },
      { value: "prepare-for-interview", label: "Prepare for technical interviews" },
      { value: "career-transition", label: "Transition to a new role" },
      { value: "deepen-expertise", label: "Deepen expertise in current field" },
      { value: "build-project", label: "Build a specific project" },
      { value: "certification", label: "Prepare for certification" },
      { value: "other", label: "Other" },
    ],
  },
  {
    id: "skillLevel",
    label: "What's your current skill level?",
    type: "radio",
    required: true,
    options: [
      { value: "beginner", label: "Beginner - New to this topic" },
      { value: "intermediate", label: "Intermediate - Some experience" },
      { value: "advanced", label: "Advanced - Deep experience" },
    ],
  },
  {
    id: "hoursPerWeek",
    label: "How many hours can you dedicate per week?",
    type: "radio",
    required: true,
    options: [
      { value: "light", label: "Light (3-5 hours/week)" },
      { value: "moderate", label: "Moderate (6-10 hours/week)" },
      { value: "intensive", label: "Intensive (10+ hours/week)" },
    ],
  },
  {
    id: "contentFormat",
    label: "What's your preferred content format?",
    type: "checkbox",
    required: true,
    options: [
      { value: "video", label: "Video tutorials" },
      { value: "text", label: "Text/articles" },
      { value: "interactive", label: "Interactive exercises" },
      { value: "mixed", label: "Mixed (recommended)" },
    ],
  },
  {
    id: "topicsOfInterest",
    label: "What topics are you interested in? (Select all that apply)",
    type: "multi-select",
    placeholder: "Select topics",
    required: true,
    options: [
      { value: "react", label: "React / Frontend" },
      { value: "nodejs", label: "Node.js / Backend" },
      { value: "python", label: "Python" },
      { value: "machine-learning", label: "Machine Learning / AI" },
      { value: "data-science", label: "Data Science" },
      { value: "devops", label: "DevOps / Cloud" },
      { value: "databases", label: "Databases" },
      { value: "system-design", label: "System Design" },
      { value: "algorithms", label: "Algorithms & Data Structures" },
      { value: "typescript", label: "TypeScript" },
      { value: "testing", label: "Testing" },
      { value: "architecture", label: "Software Architecture" },
      { value: "mobile", label: "Mobile Development" },
      { value: "security", label: "Cybersecurity" },
      { value: "blockchain", label: "Blockchain / Web3" },
    ],
  },
]

export async function GET() {
  return NextResponse.json({ questions: onboardingQuestions })
}