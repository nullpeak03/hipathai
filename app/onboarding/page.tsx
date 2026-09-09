"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  // Draft restores synchronously at init (no mount-effect setState).
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

  // Plan §2 guard: session + 1 ready roadmap visiting /onboarding -> /app/dashboard.
  // Also surfaces resume-after-tab-close for a still-generating roadmap.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me/active");
        const j = await res.json();
        if (j.activeId) router.replace(`/app/dashboard`);
        else if (j.generatingId) setResumeGen(j.generatingId);
      } catch { /* guard degrades to normal onboarding */ }
    })();
  }, [router]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
    } catch { /* private mode */ }
  }, [draft]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const canNext =
    step === 0 ? draft.goal.trim().length >= 4
    : step === 1 ? draft.deadline.length > 0
    : true;

  async function generate() {
    setBusy(true);
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
      router.push("/app/generating");
    } finally {
      // generating page takes over; keep busy until navigation
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#050A08] text-[#E6F4ED]">
      <header className="border-b border-[#10B98122]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Logo compact />
          <span className="font-mono text-xs text-[#8BA494]">step {step + 1} / 4</span>
        </div>
        <div className="mx-auto max-w-3xl px-5 pb-3">
          <div className="h-1 overflow-hidden rounded-full bg-[#0A120E]">
            <div
              className="h-full bg-[#10B981] transition-all"
              style={{ width: `${((step + 1) / 4) * 100}%` }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        {resumeGen && (
          <button
            onClick={() => router.push(`/app/generating?id=${resumeGen}`)}
            className="terminal-card mb-6 block w-full p-4 text-left hover:border-[#10B981]"
          >
            <p className="font-mono text-xs text-[#FBBF24]">resumable generation found</p>
            <p className="mt-1 text-sm">Your last path is still generating — resume →</p>
          </button>
        )}
        {step === 0 && (
          <section>
            <h1 className="font-display text-2xl font-bold">What do you want to become?</h1>
            <p className="mt-2 text-sm text-[#8BA494]">Pick a track, then describe your goal in one line.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {TRACKS.map((t) => (
                <button
                  key={t}
                  onClick={() => set("track", t)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    draft.track === t
                      ? "border-[#10B981] bg-[#10B98122] text-[#E6F4ED]"
                      : "border-[#10B98122] text-[#8BA494] hover:border-[#10B981]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              value={draft.goal}
              onChange={(e) => set("goal", e.target.value)}
              placeholder='e.g. "Become a Next.js freelancer in 3 months"'
              className="mt-5 w-full rounded-lg border border-[#10B98133] bg-[#0A120E] px-4 py-3 text-sm outline-none placeholder:text-[#8BA49466] focus:border-[#10B981]"
            />
          </section>
        )}

        {step === 1 && (
          <section>
            <h1 className="font-display text-2xl font-bold">Your starting point</h1>
            <p className="mt-2 text-sm text-[#8BA494]">Level, current stack, daily hours and deadline.</p>
            <div className="mt-5 flex gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  onClick={() => set("level", l)}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-sm ${
                    draft.level === l
                      ? "border-[#10B981] bg-[#10B98122]"
                      : "border-[#10B98122] text-[#8BA494]"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="mb-2 mt-5 text-sm text-[#8BA494]">Known stack (optional)</p>
            <div className="flex flex-wrap gap-2">
              {STACKS.map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    set("stack", draft.stack.includes(s) ? draft.stack.filter((x) => x !== s) : [...draft.stack, s])
                  }
                  className={`rounded-full border px-3 py-1.5 font-mono text-xs ${
                    draft.stack.includes(s)
                      ? "border-[#10B981] bg-[#10B98122] text-[#E6F4ED]"
                      : "border-[#10B98122] text-[#8BA494]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <label className="text-sm text-[#8BA494]">
                Hours / day: <span className="font-mono text-[#E6F4ED]">{draft.hrsPerDay}h</span>
                <input
                  type="range" min={1} max={8} value={draft.hrsPerDay}
                  onChange={(e) => set("hrsPerDay", Number(e.target.value))}
                  className="mt-2 w-full accent-[#10B981]"
                />
              </label>
              <label className="text-sm text-[#8BA494]">
                Deadline
                <input
                  type="date" value={draft.deadline}
                  onChange={(e) => set("deadline", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-[#10B98133] bg-[#0A120E] px-3 py-2 text-sm text-[#E6F4ED] outline-none focus:border-[#10B981]"
                />
              </label>
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="font-display text-2xl font-bold">How do you learn best?</h1>
            <p className="mt-2 text-sm text-[#8BA494]">Rhythm and style shape the plan.</p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <label className="text-sm text-[#8BA494]">
                Days / week: <span className="font-mono text-[#E6F4ED]">{draft.daysPerWeek}</span>
                <input
                  type="range" min={2} max={7} value={draft.daysPerWeek}
                  onChange={(e) => set("daysPerWeek", Number(e.target.value))}
                  className="mt-2 w-full accent-[#10B981]"
                />
              </label>
              <label className="text-sm text-[#8BA494]">
                Session length
                <div className="mt-2 flex gap-2">
                  {[15, 30, 60].map((m) => (
                    <button
                      key={m}
                      onClick={() => set("sessionMin", m)}
                      className={`flex-1 rounded-lg border px-2 py-2 font-mono text-sm ${
                        draft.sessionMin === m ? "border-[#10B981] bg-[#10B98122] text-[#E6F4ED]" : "border-[#10B98122] text-[#8BA494]"
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </label>
            </div>
            <p className="mb-2 mt-5 text-sm text-[#8BA494]">Preferred style</p>
            <div className="flex gap-2">
              {STYLES.map((s) => (
                <button
                  key={s}
                  onClick={() => set("style", s)}
                  className={`flex-1 rounded-lg border px-3 py-2.5 font-mono text-xs ${
                    draft.style === s ? "border-[#10B981] bg-[#10B98122] text-[#E6F4ED]" : "border-[#10B98122] text-[#8BA494]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <h1 className="font-display text-2xl font-bold">Review your path inputs</h1>
            <p className="mt-2 text-sm text-[#8BA494]">Final step — confirm, then generate.</p>
            <div className="terminal-card mt-5 divide-y divide-[#10B98118]">
              {[
                ["Goal", `${draft.track} — ${draft.goal || "—"}`, 0],
                ["Level", `${draft.level}${draft.stack.length ? ` · ${draft.stack.join(", ")}` : ""}`, 1],
                ["Time", `${draft.hrsPerDay}h/day · ${draft.daysPerWeek}d/week · ${draft.sessionMin}m sessions`, 2],
                ["Deadline + style", `${draft.deadline || "—"} · ${draft.style}`, 2],
              ].map(([k, v, edit]) => (
                <div key={k as string} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="font-mono text-xs text-[#34D399]">{k}</p>
                    <p className="mt-0.5 text-sm">{v}</p>
                  </div>
                  <button onClick={() => setStep(edit as number)} className="text-xs text-[#8BA494] underline hover:text-[#E6F4ED]">
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-lg px-4 py-2.5 text-sm text-[#8BA494] disabled:opacity-30 hover:text-[#E6F4ED]"
          >
            ← Back
          </button>
          {step < 3 ? (
            <button
              onClick={() => canNext && setStep((s) => s + 1)}
              disabled={!canNext}
              className="rounded-lg bg-[#10B981] px-6 py-2.5 text-sm font-semibold text-[#050A08] disabled:opacity-40 hover:bg-[#34D399]"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={generate}
              disabled={busy || !draft.goal.trim() || !draft.deadline}
              className="rounded-lg bg-[#10B981] px-6 py-2.5 font-mono text-sm font-bold text-[#050A08] disabled:opacity-40 hover:bg-[#34D399]"
            >
              {busy ? "Starting…" : "Generate My Path →"}
            </button>
          )}
        </div>
        {!canNext && step === 0 && (
          <p className="mt-3 text-right font-mono text-xs text-[#FBBF24]">describe your goal (min 4 chars) to continue</p>
        )}
        {!canNext && step === 1 && (
          <p className="mt-3 text-right font-mono text-xs text-[#FBBF24]">pick a deadline to continue</p>
        )}
      </main>
    </div>
  );
}
