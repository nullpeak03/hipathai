import type { LessonBlock, LessonContent } from "./lesson-content-blocks"

export type LessonStage = "teach" | "example" | "practice"

export function sectionsForLessonStage(doc: LessonContent, stage: LessonStage): LessonBlock[] {
  return doc.sections.filter((section) => {
    if (stage === "example") return section.type === "code"
    if (stage === "practice") return section.type === "exercise" || section.type === "check"
    return section.type !== "code" && section.type !== "exercise" && section.type !== "check"
  })
}
