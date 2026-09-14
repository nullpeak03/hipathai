export type Lesson = {
  id: string
  idx: number
  title: string
  phaseIdx: number
  contentMd: string
  exampleCode: string
  quiz: { q: string; options: string[]; correct: number; explanation: string }[]
  isLocked: boolean
  isCompleted: boolean
}

export type Phase = { id: string; idx: number; title: string; lessons: Lesson[] }

export function generateMockRoadmap(goal: string) {
  const title = goal ? `${goal} Roadmap (2026 Edition)` : `AI Agent Developer Roadmap (2026 Edition)`
  const phases: Phase[] = [
    {
      id: "p1", idx: 1, title: "Phase 1: Python Foundations",
      lessons: Array.from({ length: 7 }, (_, i) => ({
        id: `p1-l${i+1}`, idx: i+1, phaseIdx: 1,
        title: ["Variables & Data Types","Control Flow","Functions & Parameters","Lists & Dictionaries","OOP Basics","File Handling","Error Handling"][i] || `Lesson ${i+1}`,
        contentMd: `## ${["Variables & Data Types","Control Flow","Functions & Parameters","Lists & Dictionaries","OOP Basics","File Handling","Error Handling"][i]}\n\nLearn the fundamentals with hands-on examples. This lesson adapts to your pace and reinforces weaknesses via AI Mentor.\n\n**Key Concepts:**\n- Core syntax and idioms\n- Common pitfalls\n- Best practices in Python\n\n**Why it matters:** Foundation for AI Agents.`,
        exampleCode: `def greet(name: str) -> str:\n    return f"Hello, {name}!"\n\nprint(greet("HiPath Learner"))`,
        quiz: [
          { q: "What does this function return for greet('Ada')?", options: ["Hello, Ada!", "Hello, name!", "Error", "None"], correct: 0, explanation: "f-string interpolates name." },
          { q: "Which type hint is used for name?", options: ["int","str","bool","list"], correct: 1, explanation: "str indicates string." },
        ],
        isLocked: i !== 0, isCompleted: false
      }))
    },
    { id: "p2", idx: 2, title: "Phase 2: Python Intermediate", lessons: Array.from({ length: 7 }, (_, i) => ({ id: `p2-l${i+1}`, idx: i+1, phaseIdx: 2, title: `Intermediate ${i+1}: ${["Decorators","Generators","Async","Testing","APIs","Data Handling","Performance"][i]}`, contentMd: `## Intermediate Topic\n\nDive deeper into Python intermediate concepts with practice.`, exampleCode: `async def fetch_data():\n    return {"status": "ok"}`, quiz: [{ q: "What keyword defines async function?", options: ["async","await","def async","promise"], correct: 0, explanation: "async def"}], isLocked: true, isCompleted: false })) },
    { id: "p3", idx: 3, title: "Phase 3: AI Fundamentals", lessons: Array.from({ length: 8 }, (_, i) => ({ id: `p3-l${i+1}`, idx: i+1, phaseIdx: 3, title: `AI Concept ${i+1}`, contentMd: `## AI Fundamentals`, exampleCode: `from openai import OpenAI`, quiz: [{ q: "What is an LLM?", options: ["Large Language Model","Little Logic Machine","Linear Learning Module","Log Loss Minimizer"], correct: 0, explanation: "LLM = Large Language Model"}], isLocked: true, isCompleted: false })) },
    { id: "p4", idx: 4, title: "Phase 4: Agent Frameworks", lessons: Array.from({ length: 8 }, (_, i) => ({ id: `p4-l${i+1}`, idx: i+1, phaseIdx: 4, title: `Agent Lesson ${i+1}`, contentMd: `## Agent Frameworks`, exampleCode: `agent = Agent(tools=[search])`, quiz: [{ q: "Agents use?", options: ["Tools","Only prompts","No memory","Static"], correct: 0, explanation: "Agents use tools"}], isLocked: true, isCompleted: false })) },
    { id: "p5", idx: 5, title: "Phase 5: Capstone Projects", lessons: Array.from({ length: 10 }, (_, i) => ({ id: `p5-l${i+1}`, idx: i+1, phaseIdx: 5, title: `Project ${i+1}`, contentMd: `## Capstone`, exampleCode: `# Build your agent`, quiz: [{ q: "Capstone goal?", options: ["Ship agent","Only theory","No code","Exam"], correct: 0, explanation: "Ship"}], isLocked: true, isCompleted: false })) },
  ]
  return { id: "mock-roadmap", title, description: "Become an AI Agent developer from Python with strong foundation.", phases, totalLessons: 40 }
}
