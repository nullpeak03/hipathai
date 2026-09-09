"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Msg = { role: "user" | "assistant"; content: string };

async function fetchThread(order: number): Promise<Msg[]> {
  try {
    const r = await fetch(`/api/tutor/threads?order=${order}`);
    const j = await r.json();
    const t = (j.threads ?? [])[0];
    return (((t?.messages ?? []) as { role: string; content: string }[]).filter((m) => m.role === "user" || m.role === "assistant") as Msg[]);
  } catch {
    return [];
  }
}

export default function TutorPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#050A08] font-mono text-sm text-[#34D399]">loading tutor…</div>}>
      <TutorInner />
    </Suspense>
  );
}

function TutorInner() {
  const params = useSearchParams();
  const [roadmapId, setRoadmapId] = useState(params.get("roadmapId") ?? "");
  const [order, setOrder] = useState(Number(params.get("order") ?? 0));
  const [nodes, setNodes] = useState<{ order: number; title: string }[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [fast, setFast] = useState(false);
  const [err, setErr] = useState("");
  const [log, setLog] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/me/active").then((r) => r.json());
        const id = params.get("roadmapId") ?? me.activeId ?? "";
        setRoadmapId(id);
        if (!id) return;
        const rm = await fetch(`/api/roadmaps/${id}`).then((r) => r.json());
        setNodes((rm.nodes ?? []).map((n: { order: number; title: string }) => ({ order: n.order, title: n.title })));
      } catch { /* shell */ }
    })();
  }, [params]);

  useEffect(() => {
    if (!roadmapId) return;
    void fetchThread(order).then(setMsgs);
  }, [roadmapId, order]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy || !roadmapId) return;
    setBusy(true);
    setErr("");
    setFast(false);
    setLog("");
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setInput("");
    let acc = "";
    setMsgs((m) => [...m, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roadmapId, order, message: text }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j.message ?? j.error ?? `http_${res.status}`) as string);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let event = "";
      const apply = (raw: string) => {
        if (raw.startsWith("event:")) {
          event = raw.slice(6).trim();
          return;
        }
        if (raw.startsWith("data:")) {
          const payload = raw.slice(5).trim();
          if (event === "meta") {
            try {
              const m = JSON.parse(payload);
              if (m.fallback) {
                setFast(true);
                setLog(m.note ?? "Switched to fast mode…");
              }
            } catch { /* ignore */ }
          } else if (event === "token") {
            try {
              const d = JSON.parse(payload) as { t?: string; done?: boolean };
              if (d.t) {
                acc += d.t;
                const snap = acc;
                setMsgs((m) => {
                  const c = [...m];
                  c[c.length - 1] = { role: "assistant", content: snap };
                  return c;
                });
              }
            } catch { /* ignore */ }
          } else if (event === "error") {
            throw new Error(JSON.parse(payload).detail ?? "nim_all_failed");
          }
          event = "";
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const l of lines) if (l.trim()) apply(l.trim());
      }
      if (!acc) throw new Error("Empty reply — Retry.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "failed";
      setErr(msg);
      setMsgs((m) => m.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }, [input, busy, roadmapId, order]);

  return (
    <div className="flex min-h-screen flex-col bg-[#050A08] text-[#E6F4ED]">
      <header className="flex items-center justify-between border-b border-[#10B98122] px-5 py-3">
        <Link href="/app/dashboard" className="text-sm text-[#8BA494] hover:text-[#E6F4ED]">← Dashboard</Link>
        <span className="font-mono text-xs text-[#8BA494]">
          tutor · socratic
          {fast && <span className="ml-2 rounded-full bg-[#FBBF2422] px-2 py-0.5 text-[#FBBF24]">fast mode</span>}
        </span>
        <select
          value={order}
          onChange={(e) => setOrder(Number(e.target.value))}
          className="max-w-44 rounded-lg border border-[#10B98133] bg-[#0A120E] px-2 py-1.5 font-mono text-xs outline-none"
        >
          {nodes.map((n) => (
            <option key={n.order} value={n.order}>L{n.order} · {n.title.slice(0, 24)}</option>
          ))}
          {nodes.length === 0 && <option value={0}>lesson 0</option>}
        </select>
      </header>

      {!roadmapId && (
        <div className="mx-auto mt-8 w-full max-w-2xl px-5">
          <div className="terminal-card p-5 text-sm text-[#8BA494]">
            No active roadmap yet — the tutor needs your path for context.
            <Link href="/onboarding" className="mt-3 block rounded-lg bg-[#10B981] px-4 py-2.5 text-center font-semibold text-[#050A08]">Go to Onboarding</Link>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-3 px-5 py-6">
        {log && <p className="font-mono text-xs text-[#FBBF24]">&gt; {log}</p>}
        {msgs.length === 0 && roadmapId && (
          <div className="terminal-card p-5 text-sm text-[#8BA494]">
            Ask about your current lesson — I guide with questions first, never spoil the answer.
            <p className="mt-2 font-mono text-xs text-[#34D399]">try: “why is my useEffect fetching twice?”</p>
          </div>
        )}
        {msgs.map((m, i) => (
          <p key={i} className={`w-fit max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-[#10B98122]" : "bg-[#060D0A] text-[#C9DCD2]"}`}>
            {m.content || (busy && i === msgs.length - 1 ? "▊ thinking…" : "")}
          </p>
        ))}
        {err && (
          <div className="rounded-lg border border-[#F8717155] bg-[#F8717111] p-3 text-sm">
            <p className="text-[#F87171]">{err}</p>
            <p className="mt-1 text-xs text-[#8BA494]">Draft kept — Retry sends the same message again.</p>
          </div>
        )}
        <div ref={bottom} />
      </main>

      <footer className="border-t border-[#10B98122] px-5 py-3">
        <div className="mx-auto flex w-full max-w-2xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send()}
            placeholder="Ask for a hint, not the answer…"
            className="flex-1 rounded-lg border border-[#10B98133] bg-[#0A120E] px-4 py-2.5 text-sm outline-none placeholder:text-[#8BA49466] focus:border-[#10B981]"
          />
          <button
            onClick={() => void send()}
            disabled={busy || !input.trim() || !roadmapId}
            className="rounded-lg bg-[#10B981] px-5 py-2.5 text-sm font-bold text-[#050A08] disabled:opacity-40 hover:bg-[#34D399]"
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
      </footer>
    </div>
  );
}
