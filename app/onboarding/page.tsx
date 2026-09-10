"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";

const TRACKS = ["Frontend", "Backend", "Full-stack", "AI/ML", "DevOps", "Mobile", "DSA"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const STACKS = ["JavaScript", "TypeScript", "React", "Next.js", "Python", "Node.js", "Postgres", "Docker"];
const STYLES = ["video-first", "reading-first", "project-first"];

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
};

const KEY = "hipath-onboarding-draft";

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
  const [resumeGen, setResumeGen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me/active");
        const j = await res.json();
        if (j.activeId) router.replace(`/app/dashboard`);
        else if (j.generatingId) setResumeGen(j.generatingId);
      } catch {}
    })();
  }, [router]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
    } catch {}
  }, [draft]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const canNext = step === 0 ? draft.goal.trim().length >= 4 : step === 1 ? draft.deadline.length > 0 : true;

  async function generate() {
    setBusy(true);
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
      router.push("/app/generating");
    } finally {}
  }

  return (
    <div className="flex min-h-screen bg-[#050A08] text-[#E6F4ED]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#10B98112] bg-[#050A08] p-3 md:flex">
        <Link href="/"><Logo compact /></Link>
        <div className="mt-4 space-y-1 font-mono text-[11px]">
          <p className="px-2 text-[#10B981]">● PATHWAY // ONBOARDING-V1</p>
          <p className="px-2 text-[#8BA494]">Calibrating your track…</p>
        </div>
        <div className="mt-6 space-y-2">
          {["Goal", "Level & Stack", "Rhythm", "Review"].map((t, i) => (
            <div key={t} className={`flex items-center gap-2 rounded px-2 py-1.5 font-mono text-xs ${i === step ? "bg-[#10B98114] text-[#10B981]" : i < step ? "text-[#34D399]" : "text-[#8BA494]"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${i === step ? "bg-[#10B981] text-[#050A08]" : i < step ? "bg-[#10B98122] text-[#10B981]" : "bg-[#0A120E] text-[#8BA494]"}`}>{i + 1}</span>
              {t} {i < step && "✓"}
            </div>
          ))}
        </div>
        <div className="mt-auto rounded-lg border border-[#10B98114] bg-[#0A120E] p-3">
          <p className="font-mono text-[11px] text-[#10B981]">● {draft.track} · {draft.level}</p>
          <p className="font-mono text-[11px] text-[#8BA494]">{draft.hrsPerDay}h/day · {draft.sessionMin}m</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[#10B98112] bg-[#050A08]/90 px-4 py-2.5 backdrop-blur">
          <div className="md:hidden"><Logo compact /></div>
          <p className="hidden font-mono text-xs text-[#8BA494] md:block">● ONBOARDING // adaptive_engine_v1</p>
          <span className="font-mono text-xs text-[#8BA494]">step {step + 1} / 4</span>
        </header>
        <div className="border-b border-[#10B9810F] bg-[#070D0A] px-4 py-2">
          <div className="h-1 overflow-hidden rounded-full bg-[#0A120E]">
            <div className="h-full bg-[#10B981] transition-all" style={{ width: `${((step + 1) / 4) * 100}%` }} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-[#8BA494]">{Math.round(((step + 1) / 4) * 100)}% calibrated · {4 - step - 1} steps to launch</p>
        </div>

        <main className="mx-auto w-full max-w-3xl flex-1 p-4 md:p-6">
          {resumeGen && (
            <button onClick={() => router.push(`/app/generating?id=${resumeGen}`)} className="terminal-card mb-4 block w-full p-3 text-left hover:border-[#10B981]">
              <p className="font-mono text-xs text-[#FBBF24]">● resumable generation found</p>
              <p className="mt-1 text-sm">Your last path is still generating — resume →</p>
            </button>
          )}

          {step === 0 && (
            <div className="terminal-card p-5">
              <p className="font-mono text-[10px] tracking-widest text-[#10B981]">STEP 01 // GOAL</p>
              <h1 className="font-display mt-1 text-xl font-bold">What do you want to become?</h1>
              <p className="mt-1 font-mono text-xs text-[#8BA494]">Pick a track, then describe your goal in one line. Real AI will build 3-4 phases ×3 nodes.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {TRACKS.map((t) => (
                  <button key={t} onClick={() => set("track", t)} className={`rounded-full border px-3 py-1.5 font-mono text-xs ${draft.track === t ? "border-[#10B981] bg-[#10B98122] text-[#E6F4ED]" : "border-[#10B98122] text-[#8BA494] hover:border-[#10B981]"}`}>{t}</button>
                ))}
              </div>
              <input value={draft.goal} onChange={(e) => set("goal", e.target.value)} placeholder='e.g. "Become a Next.js freelancer in 3 months"' className="mt-4 w-full rounded-lg border border-[#10B98133] bg-[#060D0A] px-4 py-3 font-mono text-sm outline-none placeholder:text-[#8BA49466] focus:border-[#10B981]" />
            </div>
          )}

          {step === 1 && (
            <div className="terminal-card p-5">
              <p className="font-mono text-[10px] tracking-widest text-[#10B981]">STEP 02 // LEVEL & STACK</p>
              <h1 className="font-display mt-1 text-xl font-bold">Your starting point</h1>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {LEVELS.map((l) => (
                  <button key={l} onClick={() => set("level", l)} className={`rounded-lg border px-3 py-2.5 font-mono text-xs ${draft.level === l ? "border-[#10B981] bg-[#10B98122] text-[#E6F4ED]" : "border-[#10B98122] text-[#8BA494]"}`}>{l}</button>
                ))}
              </div>
              <p className="mt-4 font-mono text-xs text-[#8BA494]">Known stack (optional) — helps calibrate difficulty</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {STACKS.map((s) => (
                  <button key={s} onClick={() => set("stack", draft.stack.includes(s) ? draft.stack.filter((x) => x !== s) : [...draft.stack, s])} className={`rounded-full border px-3 py-1.5 font-mono text-xs ${draft.stack.includes(s) ? "border-[#10B981] bg-[#10B98122] text-[#E6F4ED]" : "border-[#10B98122] text-[#8BA494]"}`}>{s}</button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <label className="font-mono text-xs text-[#8BA494]">Hours / day: <span className="text-[#E6F4ED]">{draft.hrsPerDay}h</span><input type="range" min={1} max={8} value={draft.hrsPerDay} onChange={(e) => set("hrsPerDay", Number(e.target.value))} className="mt-2 w-full accent-[#10B981]" /></label>
                <label className="font-mono text-xs text-[#8BA494]">Deadline<input type="date" value={draft.deadline} onChange={(e) => set("deadline", e.target.value)} className="mt-2 w-full rounded-lg border border-[#10B98133] bg-[#060D0A] px-3 py-2 font-mono text-xs text-[#E6F4ED] outline-none focus:border-[#10B981]" /></label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="terminal-card p-5">
              <p className="font-mono text-[10px] tracking-widest text-[#10B981]">STEP 03 // RHYTHM</p>
              <h1 className="font-display mt-1 text-xl font-bold">How do you learn best?</h1>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <label className="font-mono text-xs text-[#8BA494]">Days / week: <span className="text-[#E6F4ED]">{draft.daysPerWeek}</span><input type="range" min={2} max={7} value={draft.daysPerWeek} onChange={(e) => set("daysPerWeek", Number(e.target.value))} className="mt-2 w-full accent-[#10B981]" /></label>
                <div className="font-mono text-xs text-[#8BA494]">Session length<div className="mt-2 flex gap-2">{[15, 30, 60].map((m) => (<button key={m} onClick={() => set("sessionMin", m)} className={`flex-1 rounded-lg border px-2 py-2 font-mono text-xs ${draft.sessionMin === m ? "border-[#10B981] bg-[#10B98122] text-[#E6F4ED]" : "border-[#10B98122] text-[#8BA494]"}`}>{m}m</button>))}</div></div>
              </div>
              <p className="mt-4 font-mono text-xs text-[#8BA494]">Preferred style</p>
              <div className="mt-2 flex gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => set("style", s)} className={`flex-1 rounded-lg border px-3 py-2.5 font-mono text-xs ${draft.style === s ? "border-[#10B981] bg-[#10B98122] text-[#E6F4ED]" : "border-[#10B98122] text-[#8BA494]"}`}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="terminal-card p-0">
              <div className="border-b border-[#10B9810F] px-5 py-3">
                <p className="font-mono text-[10px] tracking-widest text-[#10B981]">STEP 04 // REVIEW</p>
                <h1 className="font-display text-xl font-bold">Review your path inputs</h1>
                <p className="font-mono text-xs text-[#8BA494]">Real AI will generate 3-4 phases ×3 nodes in ~8s.</p>
              </div>
              <div className="divide-y divide-[#10B9810F]">
                {[
                  ["Goal", `${draft.track} — ${draft.goal || "—"}`, 0],
                  ["Level", `${draft.level}${draft.stack.length ? ` · ${draft.stack.join(", ")}` : ""}`, 1],
                  ["Time", `${draft.hrsPerDay}h/day · ${draft.daysPerWeek}d/week · ${draft.sessionMin}m`, 2],
                  ["Deadline + style", `${draft.deadline || "—"} · ${draft.style}`, 2],
                ].map(([k, v, edit]) => (
                  <div key={k as string} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div><p className="font-mono text-xs text-[#10B981]">{k}</p><p className="mt-0.5 font-mono text-xs">{v}</p></div>
                    <button onClick={() => setStep(edit as number)} className="font-mono text-xs text-[#8BA494] underline hover:text-[#E6F4ED]">Edit</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="rounded-lg px-4 py-2.5 font-mono text-xs text-[#8BA494] disabled:opacity-30 hover:text-[#E6F4ED]">← Back</button>
            {step < 3 ? (
              <button onClick={() => canNext && setStep((s) => s + 1)} disabled={!canNext} className="rounded-lg bg-[#10B981] px-6 py-2.5 font-mono text-xs font-bold text-[#050A08] disabled:opacity-40 hover:bg-[#34D399]">Continue →</button>
            ) : (
              <button onClick={generate} disabled={busy || !draft.goal.trim() || !draft.deadline} className="rounded-lg bg-[#10B981] px-6 py-2.5 font-mono text-xs font-bold text-[#050A08] disabled:opacity-40 hover:bg-[#34D399]">{busy ? "Starting…" : "Generate My Path →"}</button>
            )}
          </div>
          {!canNext && step === 0 && <p className="mt-3 text-right font-mono text-xs text-[#FBBF24]">describe your goal (min 4 chars) to continue</p>}
          {!canNext && step === 1 && <p className="mt-3 text-right font-mono text-xs text-[#FBBF24]">pick a deadline to continue</p>}
        </main>
      </div>
    </div>
  );
}
