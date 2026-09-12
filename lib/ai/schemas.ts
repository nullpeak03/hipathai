import { z } from "zod";

export const DraftSchema = z.object({
  track: z.string().min(2).max(40),
  goal: z.string().min(4).max(300),
  level: z.enum(["Beginner", "Intermediate", "Advanced", "Expert"]),
  stack: z.array(z.string().max(30)).max(12).default([]),
  hrsPerDay: z.number().int().min(1).max(12),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "deadline must be YYYY-MM-DD").refine((d) => new Date(d) > new Date(new Date().setHours(0, 0, 0, 0)), { message: "deadline must be in the future" }),
  daysPerWeek: z.number().int().min(2).max(7),
  sessionMin: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(90), z.literal(120)]),
  style: z.enum(["video-first", "reading-first", "project-first", "mixed"]),
  motivation: z.string().max(200).optional().default(""),
  preferredResources: z.string().max(100).optional().default(""),
  portfolioUrl: z.string().max(200).optional().default(""),
  constraints: z.array(z.string().max(30)).max(5).optional().default([]),
});

export type Draft = z.infer<typeof DraftSchema>;

export const RoadmapNodeSchema = z.object({
  order: z.number().int().min(0),
  type: z.enum(["lesson", "project"]),
  title: z.string().min(3).max(120),
  summary: z.string().min(10).max(400),
  difficulty: z.number().int().min(1).max(5),
  estMin: z.number().int().min(5).max(600),
});

export const RoadmapPhaseSchema = z.object({
  title: z.string().min(3).max(80),
  nodes: z.array(RoadmapNodeSchema).min(2).max(8),
});

export const RoadmapSchema = z.object({
  title: z.string().min(3).max(100),
  totalWeeks: z.number().int().min(1).max(52),
  phases: z.array(RoadmapPhaseSchema).min(3).max(8),
});

export type Roadmap = z.infer<typeof RoadmapSchema>;
