// Single shared prompt builder for AI roadmap generation.
// Used by both the sync endpoint (api/roadmaps) and the async Inngest
// function. Ultra decides lesson counts and objective phrasing. Titles are
// now descriptive and goal-specific (no more rigid 2-4 word concept phrase
// constraint that produced generic "Python Syntax" titles). Ultra still owns
// all naming, pacing, and prerequisite structure.
import { buildStyleGuidance } from "./style-guidance"
import { parseTimeToMinutes, parseDurationToDays } from "./roadmap-sizing"

export type RoadmapPromptInput = {
  goal: string
  level?: string
  time?: string
  duration?: string
  phases: number
  lessons?: number
  why?: string
  styles?: string | string[]
}

export const ROADMAP_JSON_SYSTEM =
  "You are a JSON generator. Output ONLY valid JSON. No explanations, no markdown, no extra text."

// Few-shot exemplars for different domains — Ultra learns the exact output shape and quality bar.
const ROADMAP_EXEMPLARS = `
Example 1 — Goal: "Build a REST API with Node.js & Express"
{
  "title": "REST API Development with Node.js & Express",
  "description": "Master building production-ready REST APIs from design to deployment.",
  "phases": [
    {"title": "API Design & HTTP Fundamentals", "lessons": [
      {"title": "REST Principles & Resource Modeling", "objective": "Design RESTful resources with proper HTTP semantics", "estimatedMinutes": 25, "difficulty": "beginner", "prerequisites": []},
      {"title": "HTTP Methods, Status Codes & Headers", "objective": "Implement correct HTTP verbs and response codes", "estimatedMinutes": 20, "difficulty": "beginner", "prerequisites": ["REST Principles & Resource Modeling"]},
      {"title": "Request Validation & Error Handling", "objective": "Build middleware for input validation and consistent errors", "estimatedMinutes": 30, "difficulty": "beginner", "prerequisites": ["HTTP Methods, Status Codes & Headers"]}
    ]},
    {"title": "Express.js Core & Middleware", "lessons": [
      {"title": "Routing, Params & Query Handling", "objective": "Implement dynamic routes with validation", "estimatedMinutes": 25, "difficulty": "beginner", "prerequisites": ["Request Validation & Error Handling"]},
      {"title": "Custom Middleware & Error Boundaries", "objective": "Write reusable middleware for auth, logging, errors", "estimatedMinutes": 30, "difficulty": "intermediate", "prerequisites": ["Routing, Params & Query Handling"]}
    ]},
    {"title": "Data Layer with Prisma & PostgreSQL", "lessons": [
      {"title": "Schema Design & Migrations", "objective": "Model relational data with Prisma schema", "estimatedMinutes": 35, "difficulty": "intermediate", "prerequisites": ["Custom Middleware & Error Boundaries"]},
      {"title": "CRUD Operations & Query Optimization", "objective": "Implement efficient database queries", "estimatedMinutes": 30, "difficulty": "intermediate", "prerequisites": ["Schema Design & Migrations"]}
    ]},
    {"title": "Authentication & Authorization", "lessons": [
      {"title": "JWT Authentication Flow", "objective": "Implement secure token-based authentication", "estimatedMinutes": 35, "difficulty": "intermediate", "prerequisites": ["CRUD Operations & Query Optimization"]},
      {"title": "Role-Based Access Control", "objective": "Enforce permissions per resource and action", "estimatedMinutes": 30, "difficulty": "advanced", "prerequisites": ["JWT Authentication Flow"]}
    ]},
    {"title": "Testing, Documentation & Deployment", "lessons": [
      {"title": "Integration Testing with Supertest", "objective": "Write tests covering happy and error paths", "estimatedMinutes": 30, "difficulty": "intermediate", "prerequisites": ["Role-Based Access Control"]},
      {"title": "OpenAPI/Swagger Documentation", "objective": "Generate interactive API docs from code", "estimatedMinutes": 25, "difficulty": "intermediate", "prerequisites": ["Integration Testing with Supertest"]},
      {"title": "Docker & Production Deployment", "objective": "Containerize and deploy to cloud with CI/CD", "estimatedMinutes": 40, "difficulty": "advanced", "prerequisites": ["OpenAPI/Swagger Documentation"]}
    ]}
  ]
}

Example 2 — Goal: "Learn Python for Data Analysis"
{
  "title": "Python Data Analysis: Pandas, Visualization & Insights",
  "description": "Go from raw data to actionable insights using Python's data stack.",
  "phases": [
    {"title": "Python Foundations for Data", "lessons": [
      {"title": "Data Types, Structures & Control Flow", "objective": "Write clean Python for data workflows", "estimatedMinutes": 25, "difficulty": "beginner", "prerequisites": []},
      {"title": "Functions, Modules & Virtual Environments", "objective": "Organize reusable analysis code", "estimatedMinutes": 20, "difficulty": "beginner", "prerequisites": ["Data Types, Structures & Control Flow"]}
    ]},
    {"title": "Pandas Core: Series & DataFrames", "lessons": [
      {"title": "Loading, Inspecting & Cleaning Data", "objective": "Import CSVs/JSON and handle missing values", "estimatedMinutes": 30, "difficulty": "beginner", "prerequisites": ["Functions, Modules & Virtual Environments"]},
      {"title": "Filtering, Grouping & Aggregation", "objective": "Answer questions with split-apply-combine", "estimatedMinutes": 35, "difficulty": "intermediate", "prerequisites": ["Loading, Inspecting & Cleaning Data"]},
      {"title": "Merging, Reshaping & Time Series", "objective": "Combine datasets and work with temporal data", "estimatedMinutes": 35, "difficulty": "intermediate", "prerequisites": ["Filtering, Grouping & Aggregation"]}
    ]},
    {"title": "Visualization & Storytelling", "lessons": [
      {"title": "Matplotlib & Seaborn Fundamentals", "objective": "Create publication-quality statistical plots", "estimatedMinutes": 30, "difficulty": "intermediate", "prerequisites": ["Merging, Reshaping & Time Series"]},
      {"title": "Interactive Plots with Plotly", "objective": "Build dashboards for stakeholder exploration", "estimatedMinutes": 25, "difficulty": "advanced", "prerequisites": ["Matplotlib & Seaborn Fundamentals"]}
    ]},
    {"title": "Capstone: End-to-End Analysis Project", "lessons": [
      {"title": "Exploratory Analysis & Hypothesis Testing", "objective": "Formulate and test data-driven hypotheses", "estimatedMinutes": 40, "difficulty": "advanced", "prerequisites": ["Interactive Plots with Plotly"]},
      {"title": "Report Generation & Presentation", "objective": "Communicate findings to non-technical audiences", "estimatedMinutes": 30, "difficulty": "advanced", "prerequisites": ["Exploratory Analysis & Hypothesis Testing"]}
    ]}
  ]
}
`

function styleSection(styles: string | string[] | undefined): string {
  const blend = buildStyleGuidance(styles)
  return blend ? ` Shape the roadmap to these learning styles:\n${blend}\n` : ""
}

/**
 * Pacing guidance derived from time-per-day so Ultra sizes lessons to the
 * learner's actual budget instead of generic "one lesson per day" assumptions.
 */
function pacingSection(time: string, duration: string): string {
  const mins = parseTimeToMinutes(time)
  const days = parseDurationToDays(duration)
  const weeks = Math.max(1, Math.ceil(days / 7))
  const dailyBudget = mins
  let pacing: string
  if (dailyBudget <= 30) {
    pacing =
      "Time budget is tight (30 min/day): keep each lesson under ~15 minutes of reading plus one very short exercise. Prefer small, digestible concepts over long explanations."
  } else if (dailyBudget <= 90) {
    pacing =
      "Moderate time budget (up to 90 min/day): lessons can be ~20–30 minutes with one graduated exercise. Balance explanation with practice."
  } else {
    pacing =
      "Generous time budget (90+ min/day): lessons can be ~30–45 minutes with applied build exercises, real-world use cases, and edge-case discussion."
  }
  return `
TIME PACING: The learner has ${dailyBudget} minutes per day over ${weeks} weeks. ${pacing} Total lesson count is a hint you adjust, but respect the daily budget — do not assign more reading than can fit in one session.`
}

export function buildRoadmapPrompt({ goal, level = "Beginner", time = "1hr/day", duration = "8 weeks", phases, why, styles }: RoadmapPromptInput): string {
  const motivation = why && why.trim().length > 0 ? ` Learner motivation: ${why.trim().slice(0, 200)}.` : ""
  const stylesBlock = styleSection(styles)
  return `You are Nemotron 3 Ultra, an expert curriculum designer. Generate a personalized roadmap for goal "${goal}". Level: ${level}, Time: ${time}, Duration: ${duration}.${motivation}

You decide ALL phase and lesson titles, lesson counts per phase, and objective wording. Make titles specific to the goal and natural — never use "Week N", "Phase N", "Part N", "Lesson N", "Step N", or "Core Concepts N". Titles must be topic-based phrases (e.g. "Async State Management", "Building a REST API with Express") and may include colons when they add clarity, but never number them.

CRITICAL ANTI-DUPLICATION RULES — VIOLATIONS CAUSE REGENERATION:
- NO duplicate phase titles across the entire roadmap
- NO duplicate lesson titles across ALL phases (global uniqueness)
- NO overlapping objectives or concepts across phases — each lesson must teach a distinct concept
- Do not create overlapping phases (e.g. separate Fetch and Async Fetch phases); merge related concepts into one phase
- Include at least one capstone lesson in a middle phase and one in the final phase
- Include security, caching, logging, and performance lessons in the deployment phase
- Titles must be concise and complete (never truncated)
- Strict prerequisite ordering: a lesson may only use concepts taught earlier in the roadmap; never reference future concepts
- Coverage: include core prerequisites needed for the goal (HTTP, Git, CSS, React, Python basics) as early phases when the learner level requires them
- Adaptive pacing: choose lesson count and estimatedMinutes from the learner level and daily time budget; keep 7 lessons per phase but adjust depth and minutes
- Include one capstone lesson in a middle phase and one in the final phase
- The final phase MUST end with an integrated capstone that completes the stated goal
- Daily time affects depth, examples, and practice; do not change the 7-lesson phase count to compensate
- If the requested duration is too short for the goal, increase lessons per phase instead of omitting the final capstone
- Do not create a separate Async Python phase; integrate async concepts into the backend phase
- The final phase should be an integrated capstone tying frontend, backend, database, auth, and deployment together
- Prerequisites MUST reference exact lesson titles from earlier phases/lessons
- Phase titles must be unique and descriptive (not "Phase 1", "Week 1")

Prerequisite structure: order lessons so each builds on concepts from earlier lessons. Where a lesson depends on an earlier lesson (in this or another phase), note that dependency so the learner never hits an unexplained reference. Earlier phases build foundations; middle phases practice; final phases synthesize.

Objectives: write each lesson objective as a measurable learning outcome starting with an action verb (Explain, Implement, Compare, Debug, Design, Evaluate). The objective must be testable by a quiz question — avoid vague goals like "Learn Python" or "Understand basics".

Sizing hint (hard constraint): generate exactly ${phases} phases and exactly 7 lessons per phase. Every lesson must directly serve the stated goal; do not drift into unrelated domains. Include one capstone lesson in the final phase.${pacingSection(time, duration)}${stylesBlock}

${ROADMAP_EXEMPLARS}

Return ONLY valid JSON shaped exactly:
{title, description, phases:[{title, lessons:[{title, objective, estimatedMinutes, difficulty, prerequisites}]}]}

- title: roadmap title
- description: 1–2 sentence summary
- phases: array of phase objects
- title: phase title (specific, not numbered, globally unique)
- lessons: array of lesson objects
- title: lesson title (globally unique across all phases)
- objective: measurable outcome starting with an action verb (unique per lesson)
- estimatedMinutes: integer 5–45, realistic reading+exercise time for this lesson
- difficulty: "beginner" | "intermediate" | "advanced" (match the learner level, ramp up in later phases)
- prerequisites: array of lesson title strings this lesson depends on (must match exact titles from earlier lessons)

No explanatory text, no markdown fences, no "Here's a thinking process:" prefix, no trailing commentary.`
}

/**
 * Split a lesson total across phases as evenly as possible (remainder goes
 * to the earliest phases). Sum of the result always equals total.
 */
export function distributeLessons(total: number, phases: number): number[] {
  if (phases <= 0) return []
  const safeTotal = Math.max(0, Math.floor(total))
  const base = Math.floor(safeTotal / phases)
  const remainder = safeTotal % phases
  return Array.from({ length: phases }, (_, i) => base + (i < remainder ? 1 : 0))
}

export type OutlinePromptInput = {
  goal: string
  level?: string
  time?: string
  duration?: string
  why?: string
  styles?: string | string[]
  phases: number
}

/** Small planning call: roadmap title, description, and phase titles only — Ultra decides all titles. */
export function buildOutlinePrompt({ goal, level = "Beginner", time = "1hr/day", duration = "8 weeks", why, styles, phases }: OutlinePromptInput): string {
  const motivation = why && why.trim().length > 0 ? ` Learner motivation: ${why.trim().slice(0, 200)}.` : ""
  const stylesBlock = styleSection(styles)
  return `You are Nemotron 3 Ultra, an expert curriculum designer. Plan a personalized roadmap for goal "${goal}". Level: ${level}, Time: ${time}, Duration: ${duration}.${motivation}

You decide all phase titles — make them specific to the goal, natural phrasing, unique, in logical learning dependency order. Never use "Week N", "Phase N", "Part N", or "Foundations N". Phase titles must be topic-based (e.g. "Python Foundations", "Building REST APIs", "Production Deployment").

CRITICAL: Phase titles MUST be globally unique — no duplicates.

Prerequisite order: arrange phases so earlier ones build foundations and later ones synthesize. Each phase should depend on concepts from earlier phases where logical.

Sizing hint: generate AT LEAST ${phases} phases (more is fine); phases MUST be a non-empty JSON array.${pacingSection(time, duration)}${stylesBlock}

Return ONLY valid JSON shaped exactly:
{title, description, phases:[{title}]}

- title: roadmap title
- description: 1–2 sentence summary
- phases: array of {title} objects (each title unique)

No explanatory text, no markdown fences, no "Here's a thinking process:" prefix.`
}

export type PhasePromptInput = {
  goal: string
  level?: string
  time?: string
  duration?: string
  why?: string
  styles?: string | string[]
  phaseIndex: number
  phaseCount: number
  phaseTitle: string
  lessonCount?: number
  /**
   * Titles already generated for this phase by earlier part-calls. Large
   * phases are expanded in sub-batches (serverless per-step budget), and
   * each call is stateless — without this the parts repeat each other.
   */
  previousTitles?: string[]
  /**
   * Lesson titles from previous phases that this phase's lessons may
   * legitimately depend on as prerequisites.
   */
  priorPhaseLessonTitles?: string[]
}

/** Expand ONE phase into its lessons — Ultra decides lesson titles, counts, and objectives. */
export function buildPhasePrompt({ goal, level = "Beginner", time = "1hr/day", duration = "8 weeks", why, styles, phaseIndex, phaseCount, phaseTitle, previousTitles, priorPhaseLessonTitles }: PhasePromptInput): string {
  const motivation = why && why.trim().length > 0 ? ` Learner motivation: ${why.trim().slice(0, 200)}.` : ""
  const stylesBlock = styleSection(styles)
  const continuation =
    previousTitles && previousTitles.length > 0
      ? ` This phase is generated in parts — these lessons are ALREADY covered, generate ONLY new lessons on different concepts, do NOT repeat or rephrase them: ${previousTitles.map((t) => `"${t.slice(0, 80)}"`).join(", ")}.\n`
      : ""
  const priorContext =
    priorPhaseLessonTitles && priorPhaseLessonTitles.length > 0
      ? ` Lessons from earlier phases that this phase's lessons may build on (use EXACT titles in prerequisites): ${priorPhaseLessonTitles.map((t) => `"${t.slice(0, 80)}"`).join(", ")}.\n`
      : ""
  return `You are Nemotron 3 Ultra, an expert curriculum designer. You are expanding phase ${phaseIndex} of ${phaseCount} (phase "${phaseTitle}") of a personalized roadmap for goal "${goal}". Level: ${level}, Time: ${time}, Duration: ${duration}.${motivation}${continuation}${priorContext}

You decide all lesson titles and objectives for THIS phase only — natural, goal-specific phrasing, unique within the phase, ordered so later lessons build on earlier ones. Avoid numbered titles ("Lesson 3", "Part 2"). Titles may be descriptive and may use colons for clarity.

CRITICAL ANTI-DUPLICATION RULES:
- Lesson titles in this phase MUST be globally unique (not used in any other phase)
- Objectives must be distinct — no two lessons teach the same concept
- Do not overlap with concepts from other phases; merge related topics instead of splitting them
- A lesson may only use concepts taught earlier in the roadmap; never reference future concepts
- If this is a middle or final phase, include one capstone lesson
- Prerequisites MUST use exact lesson titles from the priorPhaseLessonTitles list above
- Within this phase, order lessons so later ones build on earlier ones

Prerequisites: where a lesson in this phase depends on a lesson from an earlier phase (listed above), reference that lesson title in the prerequisites array. Within this phase, order lessons so later ones build on earlier ones.

Objectives: write each lesson objective as a measurable learning outcome starting with an action verb (Explain, Implement, Compare, Debug, Design, Evaluate). Testable by a quiz question — avoid vague goals like "Learn X".

Sizing hint (hard constraint): generate exactly 7 lessons for this phase. Every lesson must directly serve the stated goal; do not drift into unrelated domains.${pacingSection(time, duration)}${stylesBlock}

Return ONLY valid JSON shaped exactly:
{title, lessons:[{title, objective, estimatedMinutes, difficulty, prerequisites}]}

- title: phase title (should match "${phaseTitle}")
- lessons: array of lesson objects
- title: lesson title (globally unique across entire roadmap)
- objective: measurable outcome starting with an action verb (unique per lesson)
- estimatedMinutes: integer 5–45
- difficulty: "beginner" | "intermediate" | "advanced"
- prerequisites: array of lesson title strings this lesson depends on (must match exact titles from priorPhaseLessonTitles or earlier lessons in this phase)

No explanatory text, no markdown fences, no "Here's a thinking process:" prefix.`
}
