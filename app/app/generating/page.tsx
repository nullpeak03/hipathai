"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const LOGS = [
  "Analyzing goal…",
  "Splitting into phases…",
  "Assigning lessons + projects…",
  "Calibrating difficulty…",
];

type GenState =
  | { kind: "working" }
  | { kind: "ready"; id: string }
  | { kind: "error"; code: string; message: string };

function idemKey() {
  try {
    let k = sessionStorage.getItem("hipath-idem");
    if (!k) {
      k = crypto.randomUUID();
      sessionStorage.setItem("hipath-idem", k);
    }
    return k;
  } catch {
    return `web-${Date.now()}`;
  }
}

export default function Generating() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#050A08] font-mono text-sm text-[#34D399]">loading…</div>}>
      <GeneratingInner />
    </Suspense>
  );
}

function GeneratingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [lines, setLines] = useState(0);
  const [goal, setGoal] = useState("");
  const [fast, setFast] = useState(false);
  const [state, setState] = useState<GenState>({ kind: "working" });
  const started = useRef(false);

  const poll = useCallback(async (id: string, deadline: number) => {
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const s = await fetch(`/api/roadmaps/${id}`);
        const j = await s.json();
        if (j.status === "ready") {
          if (j.fallback) setFast(true);
          setState({ kind: "ready", id });
          router.push(`/app/roadmap/${id}`);
          return;
        }
        if (j.status === "failed" || !s.ok) {
          setState({
            kind: "error",
            code: j.error ?? "nim_all_failed",
            message: "All models busy (Ultra → Lightning → Glimmer failed). Draft saved — Retry Now.",
          });
          return;
        }
      } catch {
        // transient poll error — keep polling until deadline
      }
    }
    setState({ kind: "error", code: "timeout", message: "Still cooking after 6 minutes. Your draft is saved — Retry Now (same plan, no duplicate)." });
  }, [router]);

  const run = useCallback(async () => {
    setState({ kind: "working" });
    setFast(false);
    // Resume-after-tab-close: /app/generating?id=<generating roadmaps.id>
    const resumeId = params.get("id");
    if (resumeId) {
      void poll(resumeId, Date.now() + 6 * 60 * 1000);
      return;
    }
    let draft: unknown = null;
    try {
      const raw = localStorage.getItem("hipath-onboarding-draft");
      if (raw) {
        draft = JSON.parse(raw);
        setGoal((draft as { goal?: string }).goal ?? "");
      }
    } catch { /* ignore */ }
    if (!draft) {
      setState({ kind: "error", code: "no_draft", message: "No onboarding draft found. Go back and complete the summary step." });
      return;
    }
    try {
      const res = await fetch("/api/roadmaps/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, idempotencyKey: idemKey() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setState({
          kind: "error",
          code: json.error ?? `http_${res.status}`,
          message: json.message ?? json.detail ?? "Generation failed. Draft saved — retry.",
        });
        return;
      }
      if (json.fallback) setFast(true);
      if (json.id) {
        void poll(json.id, Date.now() + 6 * 60 * 1000);
        return;
      }
      setState({ kind: "error", code: "bad_response", message: "Unexpected server response. Retry." });
    } catch {
      setState({ kind: "error", code: "network", message: "Network error reaching the AI engine. Draft saved — Retry Now." });
    }
  }, [router, poll, params]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const t = setInterval(() => setLines((l) => (l < LOGS.length ? l + 1 : l + 0.25)), 4000);
    void run();
    return () => clearInterval(t);
  }, [run]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#050A08] px-5 py-14 text-[#E6F4ED]">
      <div className="w-full max-w-2xl">
        <p className="font-mono text-xs text-[#8BA494]">
          hipath — generating{goal ? ` · “${goal.slice(0, 60)}”` : ""}
          {fast && <span className="ml-2 rounded-full bg-[#FBBF2422] px-2 py-0.5 text-[#FBBF24]">fast mode</span>}
        </p>
        <div className="terminal-card mt-4 min-h-44 p-5 font-mono text-sm">
          {LOGS.slice(0, Math.floor(lines)).map((l) => (
            <p key={l} className="text-[#8BA494]"><span className="text-[#10B981]">&gt;</span> {l}</p>
          ))}
          {state.kind === "working" && <p className="animate-pulse text-[#34D399]">▊ working — safe to wait, drafts never lost</p>}
          {state.kind === "ready" && (
            <p className="mt-2 text-[#E6F4ED]">Path ready — opening your roadmap…</p>
          )}
          {state.kind === "error" && (
            <div className="mt-3 rounded-lg border border-[#F8717155] bg-[#F8717111] p-3">
              <p className="text-[#F87171]">error: {state.code}</p>
              <p className="mt-1 text-xs text-[#E6F4ED]">{state.message}</p>
            </div>
          )}
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#0A120E]">
          <div className="h-full bg-[#10B981] transition-all" style={{ width: `${Math.min(100, (lines / LOGS.length) * 100)}%` }} />
        </div>

        <div className="mt-4 grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="terminal-card animate-pulse p-4">
              <div className="h-3 w-2/3 rounded bg-[#10B98122]" />
              <div className="mt-2 h-3 w-1/3 rounded bg-[#10B98111]" />
            </div>
          ))}
        </div>

        <div className="mt-8 flex gap-3">
          {state.kind === "ready" ? (
            <Link href={`/app/roadmap/${state.id}`} className="flex-1 rounded-lg bg-[#10B981] px-4 py-2.5 text-center font-mono text-sm font-bold text-[#050A08] hover:bg-[#34D399]">
              Open My Roadmap →
            </Link>
          ) : (
            <button onClick={run} className="flex-1 rounded-lg bg-[#10B981] px-4 py-2.5 font-mono text-sm font-bold text-[#050A08] hover:bg-[#34D399]">
              Retry Now
            </button>
          )}
          <Link href="/onboarding" className="flex-1 rounded-lg border border-[#10B98133] px-4 py-2.5 text-center text-sm hover:border-[#10B981]">
            Back to Summary
          </Link>
        </div>
      </div>
    </div>
  );
}
