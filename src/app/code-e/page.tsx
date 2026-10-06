"use client"
import { useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { RunnableCodeBlock } from "@/components/pro/code-panels"
import { EDITOR_LANGUAGES, STARTER_TEMPLATES, type EditorLanguageId } from "@/lib/code-templates"

/** Standalone code editor: pick a language, edit, run. Drafts autosave per language. */
export default function CodeEditorPage() {
  const [lang, setLang] = useState<EditorLanguageId>("python")

  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-5xl w-full mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold">Code Editor</h1>
              <p className="text-sm text-muted-foreground mt-1">Write, run, and experiment — drafts save automatically.</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1" role="tablist" aria-label="Language">
            {EDITOR_LANGUAGES.map((l) => (
              <button
                key={l.id}
                role="tab"
                aria-selected={lang === l.id}
                onClick={() => setLang(l.id)}
                className={`shrink-0 text-xs font-medium rounded-full px-3 py-1.5 border ${
                  lang === l.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <RunnableCodeBlock
            key={lang}
            code={STARTER_TEMPLATES[lang]}
            language={lang}
            title="SCRATCHPAD"
            draftKey={`code-e:${lang}`}
          />
          <p className="text-xs text-muted-foreground mt-4">
            Runs securely in the cloud (30 runs/hour). Need lesson context? Open any lesson — every code block runs there too.
          </p>
        </main>
      </div>
    </div>
  )
}
