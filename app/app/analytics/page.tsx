"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Data = {
  xp: number; streak: number; hrs: number; quizAvg: number | null;
  completion: number; done: number; total: number;
  roadmapId: string | null; roadmapTitle: string | null;
  heatmap: { order: number; title: string; status: string; weak: boolean; difficulty: number; type: string }[];
  weakNodes: { order: number; title: string }[];
  fallbackRate: number;
  logs: { task: string; provider: string; fallback_used: boolean; ts: string }[];
  adapt: { triggered: boolean; reason: string | null; action: string | null };
};

export default function Analytics() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [adaptMsg, setAdaptMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/analytics");
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "failed");
        setD(j);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "failed");
      }
    })();
  }, []);

  async function applyAdapt() {
    setAdaptMsg("");
    try {
      const r = await fetch("/api/analytics", { method: "POST" });
      const j = await r.json();
      setAdaptMsg((j.message ?? j.error ?? "") as string);
      const fresh = await fetch("/api/analytics").then((x) => x.json());
      setD(fresh);
    } catch {
      setAdaptMsg("Adapt failed. Retry.");
    }
  }

  return (
    <div className="min-h-screen bg-[#050A08] px-5 py-10 text-[#E6F4ED]">
      <div className="mx-auto max-w-3xl">
        <Link href="/app/dashboard" className="text-sm text-[#8BA494] hover:text-[#E6F4ED]">← Dashboard</Link>
        <h1 className="font-display mt-2 text-2xl font-bold">Analytics</h1>
        {err && <p className="terminal-card mt-4 p-4 text-sm text-[#F87171]">{err}</p>}
        {!d && !err && <div className="terminal-card mt-4 animate-pulse p-5 font-mono text-sm text-[#34D399]">crunching numbers… ▊</div>}
        {d && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["streak", `${d.streak}d`],
                ["xp", `${d.xp}`],
                ["quiz avg", d.quizAvg === null ? "—" : `${d.quizAvg}%`],
                ["done", `${d.completion}%`],
              ].map(([k, v]) => (
                <div key={k} className="terminal-card p-4 text-center">
                  <p className="font-display text-2xl font-bold text-[#34D399]">{v}</p>
                  <p className="mt-1 font-mono text-xs text-[#8BA494]">{k} · ~{d.hrs}h</p>
                </div>
              ))}
            </div>

            {d.adapt.triggered && (
              <div className="terminal-card mt-4 border-[#FBBF2455] p-4">
                <p className="text-sm text-[#FBBF24]">adapt: {d.adapt.reason}</p>
                <p className="mt-1 text-xs text-[#8BA494]">{d.adapt.action}</p>
                <button onClick={() => void applyAdapt()} className="mt-3 rounded-lg bg-[#10B981] px-4 py-2 text-sm font-bold text-[#050A08]">
                  Apply Adapt
                </button>
                {adaptMsg && <p className="mt-2 font-mono text-xs text-[#34D399]">{adaptMsg}</p>}
              </div>
            )}

            <h2 className="font-display mt-8 text-lg font-bold">Skill heatmap</h2>
            <div className="mt-3 space-y-1.5">
              {d.heatmap.map((n) => (
                <div key={n.order} className="terminal-card flex items-center gap-3 px-3 py-2">
                  <span className="font-mono text-xs text-[#34D399]">{String(n.order).padStart(2, "0")}</span>
                  <span className="flex-1 truncate text-sm">{n.title}</span>
                  {n.weak && <span className="rounded-full bg-[#FBBF2422] px-2 py-0.5 font-mono text-[11px] text-[#FBBF24]">weak</span>}
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${n.status === "done" ? "bg-[#10B98122] text-[#34D399]" : "bg-[#8BA49418] text-[#8BA494]"}`}>
                    {n.status} · Lv{n.difficulty}
                  </span>
                </div>
              ))}
              {d.heatmap.length === 0 && <p className="text-sm text-[#8BA494]">No roadmap yet.</p>}
            </div>

            <h2 className="font-display mt-8 text-lg font-bold">
              Model transparency <span className="font-mono text-xs font-normal text-[#8BA494]">{d.fallbackRate}% fallback</span>
            </h2>
            <div className="terminal-card mt-3 divide-y divide-[#10B98118]">
              {d.logs.map((l, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2 font-mono text-xs">
                  <span className="text-[#C9DCD2]">{l.task} · {l.provider}</span>
                  <span className={l.fallback_used ? "text-[#FBBF24]" : "text-[#34D399]"}>
                    {l.fallback_used ? "fallback" : "primary"}
                  </span>
                </div>
              ))}
              {d.logs.length === 0 && <p className="px-4 py-3 text-xs text-[#8BA494]">No AI calls logged yet.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
