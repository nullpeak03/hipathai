"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";

const TRACKS = ["Frontend", "Backend", "Full-stack", "AI/ML", "DevOps", "Mobile", "DSA", "Data Science", "Cybersecurity", "Cloud", "Game Dev", "Blockchain", "UX/UI", "QA/Testing", "Embedded"];
const LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];
const STACKS = ["JavaScript", "TypeScript", "React", "Next.js", "Python", "Node.js", "Postgres", "Docker", "Go", "Rust", "Kubernetes", "GraphQL", "Redis", "MongoDB", "AWS", "PyTorch", "TensorFlow", "Tailwind", "Vue", "Svelte"];
const STYLES = ["video-first", "reading-first", "project-first", "mixed"];
const CONSTRAINTS = ["Time", "Motivation", "Resources", "Guidance", "Portfolio"];

type Draft = {
  track: string;
  goal: string;
  level: string;
  stack: string[];
  hrsPerDay: number;
  deadline: string;
  daysPerWeek: number;
  sessionMin: number;
  style: string;
  motivation: string;
  preferredResources: string;
  portfolioUrl: string;
  constraints: string[];
  customTrack: string;
  customStack: string;
};

const DEFAULTS: Draft = {
  track: "Full-stack",
  goal: "",
  level: "Beginner",
  stack: [],
  hrsPerDay: 2,
  deadline: "",
  daysPerWeek: 5,
  sessionMin: 30,
  style: "project-first",
  motivation: "",
  preferredResources: "",
  portfolioUrl: "",
  constraints: [],
  customTrack: "",
  customStack: "",
};

const KEY = "hipath-onboarding-draft";
const STEPS = ["Goal", "Level & Stack", "Rhythm", "Style", "Motivation", "Review"];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });
  const [busy, setBusy] = useState(false);
  const [hasPath, setHasPath] = useState<string | null>(null);
  const [resumeGen, setResumeGen] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [customTrackMode, setCustomTrackMode] = useState(false);
  const [customStackMode, setCustomStackMode] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me/active");
        const j = await res.json();
        if (j.activeId) setHasPath(j.activeId);
        if (j.generatingId) setResumeGen(j.generatingId);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(draft));
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [draft]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const canNext =
    step === 0 ? draft.goal.trim().length >= 4 && (customTrackMode ? draft.customTrack.trim().length >= 2 : draft.track.length >= 2)
    : step === 1 ? draft.deadline.length > 0 && new Date(draft.deadline) > new Date()
    : true;

  async function generate() {
    setErr("");
    setBusy(true);
    const finalTrack = customTrackMode && draft.customTrack.trim() ? draft.customTrack.trim() : draft.track;
    const finalStack = customStackMode && draft.customStack.trim() ? [...draft.stack, draft.customStack.trim()].slice(0, 12) : draft.stack;
    const payload = {
      track: finalTrack,
      goal: draft.goal.trim(),
      level: draft.level,
      stack: finalStack,
      hrsPerDay: draft.hrsPerDay,
      deadline: draft.deadline,
      daysPerWeek: draft.daysPerWeek,
      sessionMin: draft.sessionMin,
      style: draft.style as "video-first" | "reading-first" | "project-first" | "mixed",
      motivation: draft.motivation,
      preferredResources: draft.preferredResources,
      portfolioUrl: draft.portfolioUrl,
      constraints: draft.constraints,
    };
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...draft, track: finalTrack, stack: finalStack }));
      const res = await fetch("/api/roadmaps/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: payload, idempotencyKey: `web-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.error === "bad_draft" && j.issues) {
          const first = j.issues.fieldErrors ? Object.values(j.issues.fieldErrors).flat()[0] : j.issues.formErrors?.[0];
          setErr(first ? String(first) : "Invalid input. Check goal, track, and deadline (future date).");
        } else if (j.error === "daily_limit" || j.error === "weekly_limit") {
          setErr("Rate limit reached. Try again tomorrow or next week.");
        } else {
          setErr(j.message ?? j.detail ?? j.error ?? "Generation failed. Retry.");
        }
        setBusy(false);
        return;
      }
      router.push(j.status === "generating" ? `/app/generating?id=${j.id}` : `/app/roadmap/${j.id}`);
    } catch {
      setErr("Network error. Retry.");
      setBusy(false);
    }
  }

  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + 730 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  return (
    <div className="flex min-h-screen bg-[#050A08] text-[#E6F4ED]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#10B98112] bg-[#050A08] p-3 md:flex">
        <Link href="/"><Logo compact /></Link>
        <div className="mt-4 space-y-1 font-mono text-[11px]">
          <p className="px-2 text-[#10B981]">● PATHWAY // ONBOARDING-V2</p>
          <p className="px-2 text-[#8BA494]">6 steps · ~2 min</p>
        </div>
        <div className="mt-6 space-y-1">
          {STEPS.map((t, i) => (
            <div key={t} className={`flex items-center gap-2 rounded px-2 py-1.5 font-mono text-xs ${i === step ? "bg-[#10B98114] text-[#10B981]" : i < step ? "text-[#34D399]" : "text-[#8BA494]"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${i === step ? "bg-[#10B981] text-[#050A08]" : i < step ? "bg-[#10B98122] text-[#10B981]" : "bg-[#0A120E] text-[#8BA494]"}`}>{i + 1}</span>
              {t} {i < step && "✓"}
            </div>
          ))}
        </div>
        <div className="mt-auto rounded-lg border border-[#10B98114] bg-[#0A120E] p-3">
          <p className="font-mono text-[11px] text-[#10B981]">● {(customTrackMode && draft.customTrack) ? draft.customTrack : draft.track} · {draft.level}</p>
          <p className="font-mono text-[11px] text-[#8BA494]">{draft.hrsPerDay}h/day · {draft.sessionMin}m · {draft.daysPerWeek}d/week</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[#10B98112] bg-[#050A08]/90 px-4 py-2.5 backdrop-blur">
          <div className="md:hidden"><Logo compact /></div>
          <p className="hidden font-mono text-xs text-[#8BA494] md:block">● ONBOARDING // adaptive_engine_v1 · GEMINI primary ~8s</p>
          <span className="font-mono text-xs text-[#8BA494]">step {step + 1} / 6</span>
        </header>
        <div className="border-b border-[#10B9810F] bg-[#070D0A] px-4 py-2">
          <div className="h-1 overflow-hidden rounded-full bg-[#0A120E]" role="progressbar" aria-valuenow={((step + 1) / 6) * 100} aria-valuemin={0} aria-valuemax={100} aria-label="Onboarding progress">
            <div className="h-full bg-[#10B981] transition-all" style={{ width: `${((step + 1) / 6) * 100}%` }} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-[#8BA494]">{Math.round(((step + 1) / 6) * 100)}% calibrated · {6 - step - 1} steps to launch</p>
        </div>

        <main className="mx-auto w-full max-w-3xl flex-1 p-4 md:p-6">
          {hasPath && (
            <div className="terminal-card mb-4 border-[#10B98133] p-4">
              <p className="font-mono text-xs font-bold text-[#10B981]">● You already have a path — Regenerate?</p>
              <p className="font-mono text-xs text-[#8BA494]">Continue to dashboard or regenerate a new path (archives old).</p>
              <div className="mt-3 flex gap-2">
                <Link href="/app/dashboard" className="rounded-lg bg-[#10B981] px-4 py-2 font-mono text-xs font-bold text-[#050A08]">Continue to Dashboard</Link>
                <button onClick={() => setHasPath(null)} className="rounded-lg border border-[#10B98114] bg-[#0A120E] px-4 py-2 font-mono text-xs">Create New Path</button>
              </div>
            </div>
          )}
          {resumeGen && !hasPath && (
            <button onClick={() => router.push(`/app/generating?id=${resumeGen}`)} className="terminal-card mb-4 block w-full p-3 text-left hover:border-[#10B981]">
              <p className="font-mono text-xs text-[#FBBF24]">● resumable generation found</p>
              <p className="mt-1 font-mono text-xs">Your last path is still generating — resume →</p>
            </button>
          )}
          {err && <p className="terminal-card mb-4 border-[#F8717155] p-3 font-mono text-xs text-[#F87171]">{err}</p>}

          {step === 0 && (
            <div className="terminal-card p-5">
              <p className="font-mono text-[10px] tracking-widest text-[#10B981]">STEP 01 // GOAL · TRACK</p>
              <h1 className="font-display mt-1 text-xl font-bold">What do you want to become?</h1>
              <p className="mt-1 font-mono text-xs text-[#8BA494]">Pick a track (or write custom), then describe your goal.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {TRACKS.map((t) => (
                  <button key={t} onClick={() => { setCustomTrackMode(false); set("track", t); }} className={`rounded-full border px-3 py-1.5 font-mono text-xs ${!customTrackMode && draft.track === t ? "border-[#10B981] bg-[#10B98122] text-[#E6F4ED]" : "border-[#10B98122] text-[#8BA494] hover:border-[#10B981]"}`} aria-pressed={!customTrackMode && draft.track === t}>{t}</button>
                ))}
                <button onClick={() => setCustomTrackMode(!customTrackMode)} className={`rounded-full border px-3 py-1.5 font-mono text-xs ${customTrackMode ? "border-[#10B981] bg-[#10B98122] text-[#10B981]" : "border-[#10B98122] text-[#8BA494]"}`}>Custom track ✎</button>
              </div>
              {customTrackMode && <input value={draft.customTrack} onChange={(e) => set("customTrack", e.target.value)} placeholder="e.g. Quantum Computing" className="mt-3 w-full rounded-lg border border-[#10B98133] bg-[#060D0A] px-4 py-2.5 font-mono text-xs outline-none placeholder:text-[#8BA49466] focus:border-[#10B981]" />}
              <input value={draft.goal} onChange={(e) => set("goal", e.target.value)} placeholder='e.g. "Become a Next.js freelancer in 3 months"' maxLength={300} className="mt-4 w-full rounded-lg border border-[#10B98133] bg-[#060D0A] px-4 py-3 font-mono text-xs outline-none placeholder:text-[#8BA49466] focus:border-[#10B981]" />
              <p className="mt-1 text-right font-mono text-[11px] text-[#8BA494]">{draft.goal.length}/300</p>
            </div>
          )}

          {step === 1 && (
            <div className="terminal-card p-5">
              <p className="font-mono text-[10px] tracking-widest text-[#10B981]">STEP 02 // LEVEL & STACK</p>
              <h1 className="font-display mt-1 text-xl font-bold">Your starting point</h1>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {LEVELS.map((l) => (
                  <button key={l} onClick={() => set("level", l)} className={`rounded-lg border px-3 py-2.5 font-mono text-xs ${draft.level === l ? "border-[#10B981] bg-[#10B98122] text-[#E6F4ED]" : "border-[#10B98122] text-[#8BA494]"}`} aria-pressed={draft.level === l}>{l}</button>
                ))}
              </div>
              <p className="mt-4 font-mono text-xs text-[#8BA494]">Known stack (optional, max 12)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {STACKS.map((s) => (
                  <button key={s} onClick={() => set("stack", draft.stack.includes(s) ? draft.stack.filter((x) => x !== s) : draft.stack.length < 12 ? [...draft.stack, s] : draft.stack)} className={`rounded-full border px-3 py-1.5 font-mono text-xs ${draft.stack.includes(s) ? "border-[#10B981] bg-[#10B98122] text-[#E6F4ED]" : "border-[#10B98122] text-[#8BA494]"}`} aria-pressed={draft.stack.includes(s)}>{s}</button>
                ))}
                <button onClick={() => setCustomStackMode(!customStackMode)} className={`rounded-full border px-3 py-1.5 font-mono text-xs ${customStackMode ? "border-[#10B981] bg-[#10B98122] text-[#10B981]" : "border-dashed border-[#10B98144] text-[#8BA494]"}`}>+ Custom</button>
              </div>
              {customStackMode && <div className="mt-2 flex gap-2"><input value={draft.customStack} onChange={(e) => set("customStack", e.target.value)} placeholder="e.g. Svelte" className="flex-1 rounded-lg border border-[#10B98133] bg-[#060D0A] px-3 py-2 font-mono text-xs outline-none focus:border-[#10B981]" /><button onClick={() => { if (draft.customStack.trim() && draft.stack.length < 12) { set("stack", [...draft.stack, draft.customStack.trim()]); set("customStack", ""); } }} className="rounded-lg bg-[#10B98122] px-3 py-2 font-mono text-xs text-[#10B981]">Add</button></div>}
              {draft.stack.length > 0 && <p className="mt-2 font-mono text-xs text-[#10B981]">Selected: {draft.stack.join(", ")}</p>}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <label className="font-mono text-xs text-[#8BA494]">Hours / day: <span className="text-[#E6F4ED]">{draft.hrsPerDay}h</span><input type="range" min={1} max={12} value={draft.hrsPerDay} onChange={(e) => set("hrsPerDay", Number(e.target.value))} className="mt-2 w-full accent-[#10B981]" aria-label="Hours per day" /></label>
                <label className="font-mono text-xs text-[#8BA494]">Deadline (future only)<input type="date" value={draft.deadline} min={tomorrow} max={maxDate} onChange={(e) => set("deadline", e.target.value)} className="mt-2 w-full rounded-lg border border-[#10B98133] bg-[#060D0A] px-3 py-2 font-mono text-xs text-[#E6F4ED] outline-none focus:border-[#10B981]" aria-label="Deadline" /></label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="terminal-card p-5">
              <p className="font-mono text-[10px] tracking-widest text-[#10B981]">STEP 03 // RHYTHM</p>
              <h1 className="font-display mt-1 text-xl font-bold">How do you learn best?</h1>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <label className="font-mono text-xs text-[#8BA494]">Days / week: <span className="text-[#E6F4ED]">{draft.daysPerWeek}</span><input type="range" min={2} max={7} value={draft.daysPerWeek} onChange={(e) => set("daysPerWeek", Number(e.target.value))} className="mt-2 w-full accent-[#10B981]" aria-label="Days per week" /></label>
                <div className="font-mono text-xs text-[#8BA494]">Session length<div className="mt-2 flex flex-wrap gap-2">{[15, 30, 60, 90, 120].map((m) => (<button key={m} onClick={() => set("sessionMin", m)} className={`rounded-lg border px-2 py-2 font-mono text-xs ${draft.sessionMin === m ? "border-[#10B981] bg-[#10B98122] text-[#E6F4ED]" : "border-[#10B98122] text-[#8BA494]"}`} aria-pressed={draft.sessionMin === m}>{m}m</button>))}</div></div>
              </div>
              <p className="mt-4 font-mono text-xs text-[#8BA494]">Preferred style</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => set("style", s)} className={`rounded-lg border px-3 py-2.5 font-mono text-xs ${draft.style === s ? "border-[#10B981] bg-[#10B98122] text-[#E6F4ED]" : "border-[#10B98122] text-[#8BA494]"}`} aria-pressed={draft.style === s}>{s}</button>
                ))}
              </div>
              <p className="mt-2 font-mono text-[11px] text-[#8BA494]">Mixed = video + reading + project, recommended for most.</p>
            </div>
          )}

          {step === 3 && (
            <div className="terminal-card p-5">
              <p className="font-mono text-[10px] tracking-widest text-[#10B981]">STEP 04 // STYLE & RESOURCES</p>
              <h1 className="font-display mt-1 text-xl font-bold">Style & resources</h1>
              <p className="mt-1 font-mono text-xs text-[#8BA494]">What helps you learn? (optional, helps AI personalize)</p>
              <input value={draft.preferredResources} onChange={(e) => set("preferredResources", e.target.value)} placeholder="e.g. Udemy, docs, YouTube, books" maxLength={100} className="mt-4 w-full rounded-lg border border-[#10B98133] bg-[#060D0A] px-4 py-2.5 font-mono text-xs outline-none placeholder:text-[#8BA49466] focus:border-[#10B981]" />
              <p className="mt-4 font-mono text-xs text-[#8BA494]">Portfolio / GitHub (optional)</p>
              <input value={draft.portfolioUrl} onChange={(e) => set("portfolioUrl", e.target.value)} placeholder="https://github.com/you or https://your-portfolio.com" className="mt-2 w-full rounded-lg border border-[#10B98133] bg-[#060D0A] px-4 py-2.5 font-mono text-xs outline-none placeholder:text-[#8BA49466] focus:border-[#10B981]" />
              <p className="mt-1 font-mono text-[11px] text-[#8BA494]">We’ll tailor projects to your existing work.</p>
            </div>
          )}

          {step === 4 && (
            <div className="terminal-card p-5">
              <p className="font-mono text-[10px] tracking-widest text-[#10B981]">STEP 05 // MOTIVATION & CONSTRAINTS</p>
              <h1 className="font-display mt-1 text-xl font-bold">What’s driving you?</h1>
              <p className="mt-1 font-mono text-xs text-[#8BA494]">Helps AI set pace and inject remedial nodes.</p>
              <textarea value={draft.motivation} onChange={(e) => set("motivation", e.target.value)} placeholder="Why this goal? e.g. Switch careers, freelance, promotion" maxLength={200} rows={3} className="mt-4 w-full rounded-lg border border-[#10B98133] bg-[#060D0A] px-4 py-2.5 font-mono text-xs outline-none placeholder:text-[#8BA49466] focus:border-[#10B981]" />
              <p className="mt-4 font-mono text-xs text-[#8BA494]">What’s blocking you? (optional)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CONSTRAINTS.map((c) => (
                  <button key={c} onClick={() => set("constraints", draft.constraints.includes(c) ? draft.constraints.filter((x) => x !== c) : [...draft.constraints, c])} className={`rounded-full border px-3 py-1.5 font-mono text-xs ${draft.constraints.includes(c) ? "border-[#10B981] bg-[#10B98122] text-[#E6F4ED]" : "border-[#10B98122] text-[#8BA494]"}`} aria-pressed={draft.constraints.includes(c)}>{c}</button>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="terminal-card p-0">
              <div className="border-b border-[#10B9810F] px-5 py-3">
                <p className="font-mono text-[10px] tracking-widest text-[#10B981]">STEP 06 // REVIEW</p>
                <h1 className="font-display text-xl font-bold">Review your path inputs</h1>
                <p className="font-mono text-xs text-[#8BA494]">Real GEMINI AI will generate 3-4 phases ×3 nodes in ~8s.</p>
              </div>
              <div className="divide-y divide-[#10B9810F]">
                {[
                  ["Goal", `${customTrackMode && draft.customTrack ? draft.customTrack : draft.track} — ${draft.goal || "—"}`, 0],
                  ["Level & Stack", `${draft.level}${draft.stack.length ? ` · ${draft.stack.join(", ")}` : ""}`, 1],
                  ["Time", `${draft.hrsPerDay}h/day · ${draft.daysPerWeek}d/week · ${draft.sessionMin}m · ${draft.deadline || "—"}`, 1],
                  ["Style", `${draft.style}${draft.preferredResources ? ` · ${draft.preferredResources}` : ""}`, 3],
                  ["Motivation", `${draft.motivation || "—"}${draft.constraints.length ? ` · ${draft.constraints.join(", ")}` : ""}${draft.portfolioUrl ? ` · ${draft.portfolioUrl}` : ""}`, 4],
                ].map(([k, v, edit]) => (
                  <div key={k as string} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div><p className="font-mono text-xs text-[#10B981]">{k}</p><p className="mt-0.5 font-mono text-xs truncate max-w-[40ch]">{v}</p></div>
                    <button onClick={() => setStep(edit as number)} className="font-mono text-xs text-[#8BA494] underline hover:text-[#E6F4ED]">Edit</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="rounded-lg px-4 py-2.5 font-mono text-xs text-[#8BA494] disabled:opacity-30 hover:text-[#E6F4ED]">← Back</button>
            {step < 5 ? (
              <button onClick={() => canNext && setStep((s) => s + 1)} disabled={!canNext} className="rounded-lg bg-[#10B981] px-6 py-2.5 font-mono text-xs font-bold text-[#050A08] disabled:opacity-40 hover:bg-[#34D399]">Continue →</button>
            ) : (
              <button onClick={generate} disabled={busy || !draft.goal.trim() || !draft.deadline} className="rounded-lg bg-[#10B981] px-6 py-2.5 font-mono text-xs font-bold text-[#050A08] disabled:opacity-40 hover:bg-[#34D399]">{busy ? "Starting…" : "Generate My Path →"}</button>
            )}
          </div>
          {!canNext && step === 0 && <p className="mt-3 text-right font-mono text-xs text-[#FBBF24]">describe your goal + pick a track to continue</p>}
          {!canNext && step === 1 && <p className="mt-3 text-right font-mono text-xs text-[#FBBF24]">pick a future deadline to continue</p>}
        </main>
      </div>
    </div>
  );
}
