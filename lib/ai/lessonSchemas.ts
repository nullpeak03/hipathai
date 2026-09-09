import { z } from "zod";

export const LessonSchema = z.object({
  objectives: z.array(z.string().min(5).max(160)).min(2).max(6),
  md: z.string().min(300).max(12000),
  keyPoints: z.array(z.string().min(5).max(200)).min(2).max(8),
  codeExamples: z.array(z.object({
    lang: z.string().max(20),
    code: z.string().min(5).max(3000),
    note: z.string().max(200).optional(),
  })).max(4).default([]),
  videos: z.array(z.object({
    title: z.string().min(3).max(120),
    videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
    channel: z.string().max(80).optional(),
  })).max(4).default([]),
});

export type Lesson = z.infer<typeof LessonSchema>;

export const QuizQuestionSchema = z.object({
  q: z.string().min(10).max(500),
  type: z.enum(["mcq", "code-output"]),
  options: z.array(z.string().min(1).max(200)).length(4).optional(),
  answerIndex: z.number().int().min(0).max(3).optional(),
  answerText: z.string().max(300).optional(),
  explanation: z.string().min(5).max(400),
}).refine(
  (v) => (v.type === "mcq" ? v.options !== undefined && v.answerIndex !== undefined : v.answerText !== undefined),
  { message: "mcq needs options+answerIndex, code-output needs answerText" },
);

export const QuizSchema = z.object({
  questions: z.array(QuizQuestionSchema).min(5).max(8),
});

export type Quiz = z.infer<typeof QuizSchema>;
