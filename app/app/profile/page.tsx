"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InstallButton } from "@/components/InstallButton";

export default function Profile() {
  const router = useRouter();
  const [data, setData] = useState<{ user: Record<string, unknown> | null; roadmap: { title: string; goal: string; version: number } | null } | null>(null);
  const [goal, setGoal] = useState("");
  const [hrs, setHrs] = useState(2);
  const [msg, setMsg] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const j = await fetch("/api/me/profile").then((r) => r.json());
        setData(j);
        setGoal((j.roadmap?.goal ?? "") as string);
        setHrs(Number((j.user as { hrs_per_day?: number } | null)?.hrs_per_day ?? 2));
      } catch { /* shell */ }
    })();
  }, []);

  async function save() {
    setMsg("");
    const r = await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: goal || undefined, hrsPerDay: hrs }),
    });
    setMsg(r.ok ? "Saved ✓" : "Save failed. Retry.");
  }

  async function wipe() {
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    await fetch("/api/me", { method: "DELETE" });
    router.push("/");
  }

  const user = (data?.user ?? {}) as { xp?: number; streak?: number; level?: string; track?: string };

  return (
    <div className="min-h-screen bg-[#050A08] px-5 py-10 text-[#E6F4ED]">
      <div className="mx-auto max-w-2xl">
        <Link href="/app/dashboard" className="text-sm text-[#8BA494] hover:text-[#E6F4ED]">← Dashboard</Link>
        <h1 className="font-display mt-2 text-2xl font-bold">Profile</h1>

        <div className="terminal-card mt-4 p-5">
          <p className="font-mono text-xs text-[#34D399]">stats</p>
          <p className="mt-2 text-sm">XP <span className="font-mono text-[#E6F4ED]">{user.xp ?? 0}</span> · streak <span className="font-mono text-[#E6F4ED]">{user.streak ?? 0}d</span></p>
          <p className="mt-1 text-sm text-[#8BA494]">{user.track ?? "—"} · {user.level ?? "—"} · path v{data?.roadmap?.version ?? 1}</p>
          {data?.roadmap && <p className="mt-1 text-sm text-[#8BA494]">{data.roadmap.title}</p>}
        </div>

        <div className="terminal-card mt-4 p-5">
          <p className="font-mono text-xs text-[#34D399]">goal + hours</p>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="mt-3 w-full rounded-lg border border-[#10B98133] bg-[#060D0A] px-4 py-2.5 text-sm outline-none focus:border-[#10B981]"
          />
          <label className="mt-3 block text-sm text-[#8BA494]">
            Hours / day: <span className="font-mono text-[#E6F4ED]">{hrs}h</span>
            <input type="range" min={1} max={8} value={hrs} onChange={(e) => setHrs(Number(e.target.value))} className="mt-2 w-full accent-[#10B981]" />
          </label>
          <button onClick={() => void save()} className="mt-3 rounded-lg bg-[#10B981] px-4 py-2 text-sm font-bold text-[#050A08]">Save</button>
          {msg && <span className="ml-3 font-mono text-xs text-[#34D399]">{msg}</span>}
        </div>

        <div className="terminal-card mt-4 p-5">
          <p className="font-mono text-xs text-[#34D399]">app</p>
          <div className="mt-3"><InstallButton /></div>
          <div className="mt-3 flex gap-2">
            <a href="/api/me" download="hipath-export.json" className="flex-1 rounded-lg border border-[#10B98133] px-4 py-2.5 text-center text-sm">Export JSON</a>
            <button
              onClick={() => void wipe()}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold ${confirmDel ? "bg-[#F87171] text-[#050A08]" : "border border-[#F8717155] text-[#F87171]"}`}
            >
              {confirmDel ? "Confirm delete everything" : "Delete account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
