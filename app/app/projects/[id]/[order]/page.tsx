"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Submission = {
  kind: "github" | "paste";
  url?: string;
  scores: { correctness: number; structure: number; practice: number; readme: number; total: number };
  issues: string[];
  suggestions: string[];
  feedback: string;
  verified: boolean;
  pass: boolean;
  unlockedNext: number | null;
  xpGain: number;
  fallback?: boolean;
};

function GuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-5" onClick={onClose}>
      <div className="terminal-card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-bold">GitHub Guide — go public in 5 min</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[#C9DCD2]">
          <li>Create a repo on github.com (public, with README).</li>
          <li><span className="font-mono text-[#6EE7B7]">git init && git add . && git commit -m “ship v1”</span></li>
          <li><span className="font-mono text-[#6EE7B7]">git branch -M main && git remote add origin &lt;your-url&gt; && git push -u origin main</span></li>
          <li>Add a README: what it does, how to run, what you learned.</li>
          <li>Paste the public repo URL here for full 200 XP review.</li>
        </ol>
        <p className="mt-3 text-xs text-[#8BA494]">Private or unreachable repos can&apos;t be reviewed — paste-mode fallback earns half XP (100).</p>
        <button onClick={onClose} className="mt-5 w-full rounded-lg bg-[#10B981] px-4 py-2.5 text-sm font-bold text-[#050A08] hover:bg-[#34D399]">
          Got it
        </button>
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const { id, order } = useParams<{ id: string; order: string }>();
  const ord = Number(order);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [url, setUrl] = useState("");
  const [paste, setPaste] = useState("");
  const [mode, setMode] = useState<"github" | "paste">("github");
  const [guide, setGuide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notReachable, setNotReachable] = useState(false);
  const [result, setResult] = useState<Submission | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const rm = await fetch(`/api/roadmaps/${id}`).then((r) => r.json());
        const n = (rm.nodes ?? []).find((x: { order: number }) => x.order === ord);
        if (n) {
          setTitle(n.title ?? "Project");
          setBrief(n.summary ?? "");
        }
      } catch { /* shell */ }
    })();
  }, [id, ord]);

  async function submit() {
    setBusy(true);
    setErr("");
    setNotReachable(false);
    setResult(null);
    try {
      const res = await fetch("/api/projects/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "github" ? { roadmapId: id, order: ord, githubUrl: url } : { roadmapId: id, order: ord, pasted: paste },
        ),
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.error === "not_reachable") setNotReachable(true);
        setErr((j.message ?? j.error ?? "Review failed.") as string);
        return;
      }
      setResult(j as Submission);
    } catch {
      setErr("Network error. Retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050A08] px-5 py-10 text-[#E6F4ED]">
      <div className="mx-auto max-w-2xl">
        <Link href={`/app/roadmap/${id}`} className="text-sm text-[#8BA494] hover:text-[#E6F4ED]">← Path</Link>
        <h1 className="font-display mt-2 text-2xl font-bold">{title || "Project review"}</h1>
        {brief && <p className="mt-2 text-sm text-[#8BA494]">{brief}</p>}

        <div className="mt-5 flex gap-1 rounded-lg border border-[#10B98122] bg-[#0A120E] p-1">
          {(["github", "paste"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md px-3 py-1.5 font-mono text-xs ${mode === m ? "bg-[#10B98122] text-[#E6F4ED]" : "text-[#8BA494]"}`}
            >
              {m === "github" ? "github url · 200 xp" : "paste code · 100 xp"}
            </button>
          ))}
        </div>

        <div className="terminal-card mt-3 p-5">
          {mode === "github" ? (
            <>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repo (public)"
                className="w-full rounded-lg border border-[#10B98133] bg-[#060D0A] px-4 py-2.5 font-mono text-sm outline-none placeholder:text-[#8BA49466] focus:border-[#10B981]"
              />
              <button onClick={() => setGuide(true)} className="mt-2 text-xs text-[#34D399] underline hover:text-[#E6F4ED]">
                GitHub Guide — make it public, README + push steps
              </button>
            </>
          ) : (
            <>
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder="Paste your main file(s)… unverified, half XP"
                rows={8}
                className="w-full rounded-lg border border-[#10B98133] bg-[#060D0A] p-3 font-mono text-[13px] outline-none placeholder:text-[#8BA49466] focus:border-[#10B981]"
              />
              <p className="mt-2 font-mono text-xs text-[#FBBF24]">verified:false · half XP (100 on pass)</p>
            </>
          )}
          <button
            onClick={() => void submit()}
            disabled={busy || (mode === "github" ? !url.trim() : paste.trim().length < 20)}
            className="mt-4 w-full rounded-lg bg-[#10B981] px-4 py-2.5 font-mono text-sm font-bold text-[#050A08] disabled:opacity-40 hover:bg-[#34D399]"
          >
            {busy ? "Reviewing… ▊" : "Submit for Review →"}
          </button>
        </div>

        {notReachable && (
          <div className="terminal-card mt-4 border-[#FBBF2455] p-4">
            <p className="text-sm text-[#FBBF24]">Not reachable — repo is private, renamed or empty.</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setGuide(true)} className="flex-1 rounded-lg bg-[#10B981] px-3 py-2 text-sm font-bold text-[#050A08]">GitHub Guide</button>
              <button onClick={() => setMode("paste")} className="flex-1 rounded-lg border border-[#10B98133] px-3 py-2 text-sm">Use paste-mode (100 XP)</button>
            </div>
          </div>
        )}
        {err && !notReachable && (
          <div className="terminal-card mt-4 border-[#F8717155] p-4">
            <p className="text-sm text-[#F87171]">{err}</p>
            <button onClick={() => void submit()} className="mt-3 rounded-lg bg-[#10B981] px-4 py-2 text-sm font-bold text-[#050A08]">Retry Now</button>
          </div>
        )}

        {result && (
          <div className="terminal-card mt-4 p-5">
            <div className={`rounded-lg p-4 text-center ${result.pass ? "bg-[#10B98122]" : "bg-[#FBBF2422]"}`}>
              <p className="font-display text-3xl font-bold">{result.scores.total}/100</p>
              <p className="mt-1 text-sm">
                {result.pass ? `Passed — +${result.xpGain} XP ${result.verified ? "(verified ✓)" : "(unverified)"}` : `Below 70 — revise and resubmit (+${result.xpGain} XP participation)`}
              </p>
              {result.fallback && <p className="mt-1 font-mono text-xs text-[#FBBF24]">fast mode review</p>}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center font-mono text-xs">
              {[["correct", result.scores.correctness, 40], ["struct", result.scores.structure, 25], ["practice", result.scores.practice, 20], ["readme", result.scores.readme, 15]].map(([k, v, max]) => (
                <div key={k as string} className="rounded-lg bg-[#060D0A] p-2">
                  <p className="text-[#34D399]">{v as number}/{max as number}</p>
                  <p className="text-[#8BA494]">{k as string}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-[#C9DCD2]">{result.feedback}</p>
            {result.issues.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#FBBF24]">
                {result.issues.map((i) => <li key={i}>{i}</li>)}
              </ul>
            )}
            {result.suggestions.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#8BA494]">
                {result.suggestions.map((s) => <li key={s}>{s}</li>)}
              </ul>
            )}
            <div className="mt-4 flex gap-2">
              {result.pass && result.unlockedNext !== null && (
                <Link href={`/app/lesson/${id}/${result.unlockedNext}`} className="flex-1 rounded-lg bg-[#10B981] px-4 py-2.5 text-center text-sm font-bold text-[#050A08]">
                  Next Node →
                </Link>
              )}
              {result.pass && result.unlockedNext === null && (
                <Link href={`/app/roadmap/${id}`} className="flex-1 rounded-lg bg-[#10B981] px-4 py-2.5 text-center text-sm font-bold text-[#050A08]">
                  Back to Path ✓
                </Link>
              )}
              {!result.pass && (
                <button onClick={() => setResult(null)} className="flex-1 rounded-lg bg-[#10B981] px-4 py-2.5 text-sm font-bold text-[#050A08]">
                  Revise + Resubmit
                </button>
              )}
              <Link href={`/app/tutor?roadmapId=${id}&order=${ord}`} className="flex-1 rounded-lg border border-[#10B98133] px-4 py-2.5 text-center text-sm">
                Ask Tutor
              </Link>
            </div>
          </div>
        )}
      </div>
      {guide && <GuideModal onClose={() => setGuide(false)} />}
    </div>
  );
}
