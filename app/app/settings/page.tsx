"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { InstallButton } from "@/components/InstallButton";

type Log = { task: string; provider: string; latency_ms: number; fallback_used: boolean; error_code: string | null; ts: string };

export default function Settings() {
  const router = useRouter();
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [msg, setMsg] = useState("");
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  useEffect(() => {
    (async () => {
      try {
        const j = await fetch("/api/me/diagnostics").then((r) => r.json());
        setLogs(j.logs ?? []);
      } catch {
        setLogs([]);
      }
    })();
  }, []);

  async function regen() {
    setMsg("");
    const r = await fetch("/api/me/regenerate", { method: "POST" });
    if (r.ok) router.push("/onboarding");
    else setMsg("Regenerate failed. Retry.");
  }

  return (
    <div className="min-h-screen bg-[#050A08] px-5 py-10 text-[#E6F4ED]">
      <div className="mx-auto max-w-2xl">
        <Link href="/app/dashboard" className="text-sm text-[#8BA494] hover:text-[#E6F4ED]">← Dashboard</Link>
        <h1 className="font-display mt-2 text-2xl font-bold">Settings</h1>

        <div className="terminal-card mt-4 p-5">
          <p className="font-mono text-xs text-[#34D399]">path</p>
          <p className="mt-2 text-sm text-[#8BA494]">Regenerating archives the current path (v+1 on next generate).</p>
          <button onClick={() => void regen()} className="mt-3 rounded-lg bg-[#10B981] px-4 py-2 text-sm font-bold text-[#050A08]">
            Regenerate Path
          </button>
          {msg && <span className="ml-3 font-mono text-xs text-[#F87171]">{msg}</span>}
        </div>

        <div className="terminal-card mt-4 p-5">
          <p className="font-mono text-xs text-[#34D399]">pwa + session</p>
          <div className="mt-3"><InstallButton /></div>
          {clerkKey ? <SignOutButton /> : (
            <Link href="/" className="mt-3 inline-block rounded-lg border border-[#10B98133] px-4 py-2 text-sm">
              Back home (auth preview)
            </Link>
          )}
        </div>

        <div className="terminal-card mt-4 p-5">
          <p className="font-mono text-xs text-[#34D399]">diagnostics · ai_logs</p>
          {!logs && <p className="mt-2 animate-pulse font-mono text-xs text-[#8BA494]">loading…</p>}
          {logs && logs.length === 0 && <p className="mt-2 text-xs text-[#8BA494]">No AI calls yet.</p>}
          {logs && logs.length > 0 && (
            <div className="mt-2 divide-y divide-[#10B98118] font-mono text-xs">
              {logs.map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-[#C9DCD2]">{l.task} · {l.provider} · {l.latency_ms}ms</span>
                  <span className={l.fallback_used ? "text-[#FBBF24]" : "text-[#34D399]"}>
                    {l.fallback_used ? "fallback" : "primary"}{l.error_code ? ` · ${l.error_code.slice(0, 24)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SignOutButton() {
  const router = useRouter();
  const { signOut } = useClerk();
  return (
    <button
      onClick={() => void signOut(() => router.push("/"))}
      className="mt-3 rounded-lg border border-[#10B98133] px-4 py-2 text-sm"
    >
      Sign out
    </button>
  );
}
