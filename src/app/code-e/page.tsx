"use client"

import dynamic from "next/dynamic"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"

// CodeMirror + the workspace panels are the heavy part of this route. Keep
// them client-only so the shell (sidebar/header) paints immediately.
const CodeWorkspace = dynamic(
  () => import("@/components/code/CodeWorkspace").then((mod) => mod.CodeWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="h-[calc(100vh-3.5rem)] min-h-[32rem] flex items-center justify-center bg-app text-sm text-muted-foreground">
        Loading editor…
      </div>
    ),
  }
)

/** Standalone IDE-lite workspace: multiple files, local autosave, run active file. */
export default function CodeEditorPage() {
  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 min-w-0">
          <CodeWorkspace />
        </main>
      </div>
    </div>
  )
}
