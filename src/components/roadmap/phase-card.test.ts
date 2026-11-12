import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Lesson, Phase } from "@/lib/mockData"
import { PhaseCard } from "./phase-card"

function renderPhase(overrides: { phase: Phase; open?: boolean; state?: "done" | "current" | "open" | "todo" }) {
  return renderToStaticMarkup(
    createElement(PhaseCard, {
      roadmapId: "roadmap-1",
      phase: overrides.phase,
      index: 0,
      totalPhases: 1,
      state: overrides.state ?? "current",
      progress: {},
      phaseProgress: {},
      open: overrides.open ?? true,
      onToggle: () => {},
      viewMode: "grid",
      isLocked: () => false,
      examLoaded: false,
      examSubmitted: false,
      examPassed: false,
      examScore: null,
      examAnswered: 0,
      examQuestionCount: 0,
      examBusy: false,
      onStartCheckpoint: () => {},
      onOpenCheckpoint: () => {},
    })
  )
}

const EMPTY_PHASE: Phase = { id: "phase-empty", idx: 0, title: "Foundations", lessons: [] }

const PHASE_WITH_LESSONS: Phase = {
  id: "phase-1",
  idx: 0,
  title: "Foundations",
  lessons: [
    { id: "lesson-1", idx: 0, title: "Variables" },
    { id: "lesson-2", idx: 1, title: "Functions" },
  ] as Lesson[],
}

describe("PhaseCard zero-lesson guard", () => {
  it("does not claim a checkpoint is locked behind zero lessons", () => {
    const html = renderPhase({ phase: EMPTY_PHASE, state: "todo" })
    expect(html).toContain("No lessons yet · checkpoint unavailable")
    expect(html).toContain("This phase has no lessons yet")
    expect(html).not.toContain("Pass all 0 lessons")
    expect(html).not.toContain("0 of 0 lessons passed")
    expect(html).not.toContain("Checkpoint locked")
  })

  it("still reports normal lesson progress for a populated phase", () => {
    const html = renderPhase({ phase: PHASE_WITH_LESSONS })
    expect(html).toContain("0 of 2 lessons passed")
    expect(html).not.toContain("This phase has no lessons yet")
  })
})
