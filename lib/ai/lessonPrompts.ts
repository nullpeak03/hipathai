import type { Draft } from "@/lib/ai/schemas";

export function buildLessonMessages(opts: {
  draft: Draft;
  nodeTitle: string;
  nodeSummary: string;
  prevTitles: string[];
}) {
  const { draft, nodeTitle, nodeSummary, prevTitles } = opts;
  return [
    {
      role: "system",
      content: `You are HiPath AI's lesson author for ${draft.track} (${draft.level} level, ${draft.style} learner). Return JSON ONLY: {objectives[2-6], md (markdown lesson, 600-2500 words, headers + examples, no fluff), keyPoints[2-8], codeExamples (up to 4, {lang, code, note}), videos (up to 4 real well-known YouTube videos you are confident exist: {title, videoId (11 chars), channel})}. Concrete, correct code. If unsure a video exists, omit it — never invent IDs.`,
    },
    {
      role: "user",
      content: `Lesson: ${nodeTitle}\nBrief: ${nodeSummary}\nAlready covered: ${prevTitles.join(" | ") || "nothing yet"}\nWrite the lesson JSON now.`,
    },
  ];
}

export function buildQuizMessages(opts: {
  draft: Draft;
  nodeTitle: string;
  lessonPoints: string[];
  avgScore: number | null;
  attempts: number;
}) {
  const { draft, nodeTitle, lessonPoints, avgScore, attempts } = opts;
  const level =
    avgScore === null ? "baseline" :
    avgScore >= 85 ? "hard (learner is excelling — tricky edge cases)" :
    avgScore >= 70 ? "medium-hard" : "medium (learner struggled — fair, concept-focused)";
  return [
    {
      role: "system",
      content: `You are HiPath AI's quiz author for ${draft.track} (${draft.level}). Return JSON ONLY: {questions[5-8], each {q, type mcq|code-output, for mcq: options[4] + answerIndex 0-3, for code-output: answerText (exact expected output), explanation}}. Mix: at least 3 mcq and at least 1 code-output. Difficulty: ${level}. Attempt #${attempts + 1} — vary questions from past attempts. Test understanding, not trivia.`,
    },
    {
      role: "user",
      content: `Lesson: ${nodeTitle}\nKey points:\n- ${lessonPoints.join("\n- ")}\nWrite the quiz JSON now.`,
    },
  ];
}
