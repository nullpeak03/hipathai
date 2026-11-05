"use client"

// Compatibility entry point for lesson code blocks and quiz snippets.
// The editor internals live in src/components/code/*; these exports keep the
// existing call sites stable while the workspace gets the new UI.

import { LessonCodeWorkspace } from "@/components/code/LessonCodeWorkspace"
import { PanelShell, ProUpgradeDialog, StaticCodePanel } from "@/components/code/panel-shell"
import { CopyButton } from "@/components/code/panel-shell"
import { runnerLanguage } from "@/lib/code-runner"

export { ProUpgradeDialog, StaticCodePanel }

/** Editable + runnable block. Props are unchanged from the pre-upgrade editor. */
export function RunnableCodeBlock({ code, language, title, draftKey, testCases }: {
  code: string
  language: string
  title?: string
  draftKey?: string
  testCases?: { input: string; expected: string }[]
}) {
  return (
    <LessonCodeWorkspace
      code={code}
      language={language}
      title={title}
      draftKey={draftKey}
      testCases={testCases}
    />
  )
}

/**
 * Editor shell: runnable languages get the editor UI; others get the static
 * panel. Actual execution is gated server-side, so this component never
 * decides access — 402s surface the dialog.
 */
export function ProCodePanel({ code, language, title, draftKey }: {
  code: string
  language: string
  title?: string
  draftKey?: string
}) {
  if (runnerLanguage(language) !== null) {
    return <LessonCodeWorkspace code={code} language={language} title={title} draftKey={draftKey} />
  }
  return (
    <PanelShell title={title} language={language} action={<CopyButton text={code} />}>
      <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-xl overflow-x-auto text-sm"><code>{code}</code></pre>
    </PanelShell>
  )
}
