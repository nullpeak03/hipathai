"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Node = {
  order: number;
  phase?: string;
  type: string;
  title: string;
  summary: string;
  difficulty: number;
  estMin: number;
  locked: boolean;
  status: string;
};

export default function RoadmapView() {
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (id === "preview") {
        try {
          const raw = sessionStorage.getItem("hipath-roadmap-preview");
          if (!raw) {
            setError("No preview cached. Generate again from onboarding.");
            return;
          }
          const rm = JSON.parse(raw);
          setTitle(rm.title ?? "Your path");
          setNodes(rm.nodes ?? []);
        } catch {
          setError("Preview unreadable. Generate again.");
        }
        return;
      }
      try {
        const res = await fetch(`/api/roadmaps/${id}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error === "no_store" ? "Server store not configured yet." : (json.detail ?? json.error ?? "Not found"));
          return;
        }
        setTitle(json.title ?? json.goal ?? "Your path");
        setNodes(json.nodes ?? []);
      } catch {
        setError("Network error loading roadmap.");
      }
    })();
  }, [id]);

  return (
    <div className="min-h-screen bg-[#050A08] px-5 py-10 text-[#E6F4ED]">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-xs text-[#8BA494]">hipath — roadmap {id === "preview" ? "(preview, not saved)" : ""}</p>
        <h1 className="font-display mt-2 text-3xl font-bold">{title || "Loading…"}</h1>
        {error && (
          <div className="terminal-card mt-6 border-[#F8717155] p-4">
            <p className="text-sm text-[#F87171]">{error}</p>
            <div className="mt-3 flex gap-3">
              <Link href="/app/generating" className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#050A08]">Retry Now</Link>
              <Link href="/onboarding" className="rounded-lg border border-[#10B98133] px-4 py-2 text-sm">Back to Summary</Link>
            </div>
          </div>
        )}
        {nodes && (
          <div className="mt-6 space-y-2">
            {nodes.map((n) => {
              const row = (
                <>
                  <span className="font-mono text-xs text-[#34D399]">{String(n.order).padStart(2, "0")}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="mt-0.5 text-xs text-[#8BA494]">{n.phase ? `${n.phase} · ` : ""}{n.type} · Lv{n.difficulty} · ~{n.estMin}m</p>
                    <p className="mt-1 text-xs text-[#8BA494]">{n.summary}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] ${n.locked ? "bg-[#8BA49418] text-[#8BA494]" : "bg-[#10B981] text-[#050A08]"}`}>
                    {n.order === 0 ? "open" : n.locked ? "locked" : n.status}
                  </span>
                </>
              );
              return n.locked ? (
                <div key={n.order} className="terminal-card flex items-center gap-3 p-4 opacity-80">{row}</div>
              ) : n.type === "project" ? (
                <Link key={n.order} href={`/app/projects/${id}/${n.order}`} className="terminal-card flex items-center gap-3 p-4 hover:border-[#10B981]">{row}</Link>
              ) : (
                <Link key={n.order} href={`/app/lesson/${id}/${n.order}`} className="terminal-card flex items-center gap-3 p-4 hover:border-[#10B981]">{row}</Link>
              );
            })}
            <div className="flex gap-3 pt-4">
              <Link href="/app/dashboard" className="flex-1 rounded-lg border border-[#10B98133] px-4 py-2.5 text-center text-sm">Dashboard</Link>
              <span className="flex-1 rounded-lg bg-[#0A120E] px-4 py-2.5 text-center font-mono text-xs text-[#8BA494]">quiz 70% / project pass unlocks next</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
