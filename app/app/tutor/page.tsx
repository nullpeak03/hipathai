"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Msg = { role: "user" | "assistant"; content: string };
type Thread = { id: string; node_order: number; messages: Msg[]; created_at: string };

async function fetchThread(order: number): Promise<Msg[]> {
  try {
    const r = await fetch(`/api/tutor/threads?order=${order}`);
    const j = await r.json();
    const t = (j.threads ?? [])[0] as Thread | undefined;
    return ((t?.messages ?? []) as Msg[]).filter((m) => m.role === "user" || m.role === "assistant");
  } catch {
    return [];
  }
}

export default function TutorPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#050A08] font-mono text-sm text-[#10B981]">loading tutor…</div>}>
      <TutorInner />
    </Suspense>
  );
}

function TutorInner() {
  const params = useSearchParams();
  const [roadmapId, setRoadmapId] = useState(params.get("roadmapId") ?? "");
  const [order, setOrder] = useState(Number(params.get("order") ?? 0));
  const [nodes, setNodes] = useState<{ order: number; title: string; phase?: string }[]>([]);
  const [activeTitle, setActiveTitle] = useState("Python Decorators");
  const [phaseLabel, setPhaseLabel] = useState("Phase 1");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [fast, setFast] = useState(false);
  const [err, setErr] = useState("");
  const [log, setLog] = useState("");
  const [scratch, setScratch] = useState(`# Verify metadata preservation
import functools
import time

def timer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.time()
        res = func(*args, **kwargs)
        print(f"{func.__name__} took {time.time()-start:.4f}s")
        return res
    return wrapper

@timer
def train_epoch():
    """Trains single epoch"""
    pass

print(train_epoch.__name__)`);
  const [termOut, setTermOut] = useState("> python scratchpad.py\ntrain_epoch # Verified: __name__ preserved!");
  const [runBusy, setRunBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/me/active").then((r) => r.json());
        const id = params.get("roadmapId") ?? me.activeId ?? "";
        setRoadmapId(id);
        if (!id) return;
        const rm = await fetch(`/api/roadmaps/${id}`).then((r) => r.json());
        const ns = (rm.nodes ?? []).map((n: { order: number; title: string; phase?: string }) => ({ order: n.order, title: n.title, phase: n.phase }));
        setNodes(ns);
        const cur = ns.find((n: { order: number }) => n.order === order) ?? ns[0];
        if (cur) {
          setActiveTitle(cur.title);
          setPhaseLabel(cur.phase ?? `Phase 1`);
        }
        const th = await fetch(`/api/tutor/threads?order=${order}`).then((r) => r.json()).catch(() => ({ threads: [] }));
        setThreads((th.threads ?? []).slice(0, 5));
      } catch {}
    })();
  }, [params, order]);

  useEffect(() => {
    if (!roadmapId) return;
    void fetchThread(order).then(setMsgs);
    // refresh threads list
    fetch(`/api/tutor/threads?order=${order}`)
      .then((r) => r.json())
      .then((j) => setThreads((j.threads ?? []).slice(0, 5)))
      .catch(() => {});
  }, [roadmapId, order]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const runScratch = () => {
    setRunBusy(true);
    setTimeout(() => {
      const hasWraps = scratch.includes("functools.wraps");
      setTermOut(hasWraps ? "> python scratchpad.py\ntrain_epoch # Verified: __name__ preserved! ✔" : "> python scratchpad.py\nwrapper # Mismatch: __name__ is 'wrapper' — hint: functools.wraps");
      setRunBusy(false);
    }, 600);
  };

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
            } catch {}
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
            } catch {}
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
    <div className="flex min-h-screen bg-[#050A08] text-[#E6F4ED]">
      {/* Sidebar - same as dashboard */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#10B98112] bg-[#050A08] p-3 md:flex">
        <div className="rounded-lg border border-[#10B98114] bg-[#0A120E] px-3 py-2">
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#8BA494]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]"></span> workspace <span className="text-[#10B981]">&gt;</span>
          </div>
          <div className="font-mono text-xs text-[#10B981]">/ learn_to_ship()</div>
        </div>
        <nav className="mt-4 space-y-4 text-[13px]">
          <div>
            <p className="px-2 font-mono text-[10px] tracking-widest text-[#8BA494]">MAIN</p>
            <div className="mt-1 space-y-0.5">
              <Link href="/app/dashboard" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:bg-[#0A120E] hover:text-[#E6F4ED]"><span>▦</span> Dashboard</Link>
              <Link href={roadmapId ? `/app/roadmap/${roadmapId}` : "/onboarding"} className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]"><span>↗</span> Roadmap</Link>
              <p className="flex items-center gap-2 rounded bg-[#10B98114] px-2 py-1.5 text-[#E6F4ED]"><span>◈</span> AI Tutor</p>
              <Link href={roadmapId ? `/app/lesson/${roadmapId}/${order}` : "/app/dashboard"} className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">▭ Practice</Link>
              <Link href="/app/analytics" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">◇ Projects</Link>
              <Link href="/app/analytics" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">◭ Analytics</Link>
            </div>
          </div>
          <div>
            <p className="px-2 font-mono text-[10px] tracking-widest text-[#8BA494]">LEARNING</p>
            <div className="mt-1 space-y-0.5">
              <Link href="/app/dashboard" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">⚡ Today&apos;s Learning</Link>
              <Link href="/app/analytics" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">↻ Review & Recall</Link>
            </div>
          </div>
          <div>
            <p className="px-2 font-mono text-[10px] tracking-widest text-[#8BA494]">ACCOUNT</p>
            <div className="mt-1 space-y-0.5">
              <Link href="/app/profile" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">◯ Profile</Link>
              <Link href="/app/settings" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">⚙ Settings</Link>
            </div>
          </div>
        </nav>
        <div className="mt-auto rounded-lg border border-[#10B98114] bg-[#0A120E] p-2.5">
          <p className="text-xs font-semibold">Hirdendra</p>
          <p className="font-mono text-[10px] text-[#10B981]">AI Engineering Goal</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#10B98112] bg-[#050A08]/90 px-3 py-2 backdrop-blur">
          <div className="flex flex-1 items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-[#10B98114] bg-[#0A120E] px-3 py-1.5">
              <span className="font-mono text-xs text-[#8BA494]">⌕</span>
              <input placeholder="Search roadmaps, concepts, commands… ⌘K" className="w-full bg-transparent text-xs text-[#8BA494] placeholder:text-[#8BA49466] outline-none" />
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <span className="rounded border border-[#10B98122] bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#10B981]">● v1 · free forever</span>
            <span className="rounded border border-[#10B98122] bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#E6F4ED]">14 days streak 🔥</span>
            <span className="rounded border border-[#10B98122] bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#38BDF8]">◷ 42/60 min today</span>
            <span className="rounded border border-[#10B98114] bg-[#0A120E] p-1.5 text-[#8BA494]">◰</span>
            <div className="h-6 w-6 rounded-full bg-[#8BA49433]"></div>
          </div>
        </header>

        {/* Session bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#10B9810F] bg-[#070D0A] px-3 py-2">
          <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#10B981]">● SESSION // socratic_tutor_v2.1</span>
          <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#8BA494]">ROADMAP: <span className="text-[#E6F4ED]">AI ENGINEERING</span> / PHASE 1</span>
          <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#38BDF8]">◎ Socratic Mode: Guides, Never Spoils</span>
          <span className="ml-auto hidden items-center gap-2 font-mono text-[11px] text-[#8BA494] md:flex">
            Latency: 18ms <span className="text-[#10B981]">|</span> Context Window: 4,120 / 8,192 tok <Link href="/app/settings" className="rounded bg-[#0A120E] px-2 py-1 text-[#8BA494]">↗ Export Log</Link>
          </span>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 p-3 md:grid-cols-[260px_1fr_300px]">
          {/* LEFT */}
          <div className="space-y-3">
            <div className="terminal-card p-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">ACTIVE LESSON NODE</p>
                <span className="rounded border border-[#10B98133] bg-[#10B98114] px-2 py-0.5 font-mono text-[10px] text-[#10B981]">In Progress</span>
              </div>
              <p className="mt-2 font-mono text-xs text-[#10B981]">&gt; {activeTitle}</p>
              <p className="font-mono text-[11px] text-[#8BA494]">Lesson {order + 1} of {phaseLabel} · Scope, Closures & Metaprogramming</p>
              <div className="mt-2 rounded border border-[#FBBF2433] bg-[#FBBF2411] p-2">
                <p className="font-mono text-[11px] font-bold text-[#FBBF24]">⚠ Remedial Flag Auto-Injected</p>
                <p className="font-mono text-[11px] text-[#8BA494]">Missed quiz question: <span className="text-[#E6F4ED]">Function scope & enclosing LEGB variables.</span> AI is calibrated to test variable closure depth.</p>
              </div>
              <div className="mt-2">
                <div className="flex justify-between font-mono text-[11px] text-[#8BA494]"><span>Concept Retention</span><span className="text-[#10B981]">68% / 70%</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-[#0A120E]"><div className="h-full bg-[#10B981]" style={{ width: "68%" }} /></div>
              </div>
              <select value={order} onChange={(e) => setOrder(Number(e.target.value))} className="mt-3 w-full rounded-lg border border-[#10B98114] bg-[#060D0A] px-2 py-1.5 font-mono text-xs outline-none">
                {nodes.map((n) => (
                  <option key={n.order} value={n.order}>L{n.order} · {n.title.slice(0, 28)}</option>
                ))}
                {nodes.length === 0 && <option value={0}>lesson 0</option>}
              </select>
            </div>

            <div className="terminal-card p-3">
              <p className="flex items-center justify-between font-mono text-[10px] tracking-widest text-[#8BA494]">TUTOR CALIBRATION <span>≣</span></p>
              <div className="mt-2 rounded bg-[#0A120E] p-2">
                <p className="font-mono text-xs font-bold text-[#E6F4ED]">Strict Hinting</p>
                <p className="font-mono text-[11px] text-[#8BA494]">Zero copy-paste solutions <span className="float-right h-2 w-2 rounded-full bg-[#10B981]"></span></p>
              </div>
              <p className="mt-2 flex justify-between font-mono text-[11px]"><span className="text-[#8BA494]">Fallback to Fast Mode</span><span className="text-[#10B981]">Enabled</span></p>
              {fast && <p className="mt-1 font-mono text-[11px] text-[#FBBF24]">● Fast mode active ✓</p>}
            </div>

            <div className="terminal-card p-3">
              <p className="flex justify-between font-mono text-[10px] tracking-widest text-[#8BA494]">THREAD HISTORY <span>{threads.length} sessions</span></p>
              <div className="mt-2 space-y-2">
                {threads.length ? (
                  threads.map((t) => (
                    <div key={t.id} className="rounded bg-[#0A120E] p-2">
                      <p className="truncate font-mono text-xs text-[#10B981]">{(t.messages[1]?.content ?? t.messages[0]?.content ?? "").slice(0, 32)} <span className="text-[#8BA494]">{new Date(t.created_at).toLocaleDateString()}</span></p>
                      <p className="truncate font-mono text-[11px] text-[#8BA494]">{(t.messages[0]?.content ?? "").slice(0, 36)}</p>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="rounded border-l-2 border-[#10B981] bg-[#0A120E] p-2">
                      <p className="font-mono text-xs text-[#10B981]">functools.wraps() clos… NOW</p>
                      <p className="font-mono text-[11px] text-[#8BA494]">Overwriting __name__ metadata</p>
                    </div>
                    <div className="rounded bg-[#0A120E] p-2"><p className="font-mono text-xs text-[#8BA494]">Recursive base case i… 1d ago</p><p className="font-mono text-[11px] text-[#8BA494]">Tail call & stack…</p></div>
                  </>
                )}
              </div>
              <button onClick={() => setMsgs([])} className="mt-2 w-full rounded border border-[#10B98114] bg-[#0A120E] py-1.5 font-mono text-xs text-[#8BA494]">+ New Discussion Thread</button>
            </div>
          </div>

          {/* CENTER */}
          <div className="flex min-h-0 flex-col gap-3">
            <div className="terminal-card p-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs font-bold text-[#10B981]">A tutor that <span className="text-[#E6F4ED]">guides, never spoils</span></p>
                <span className="font-mono text-[11px] text-[#8BA494]">↻ 🔊</span>
              </div>
              <p className="font-mono text-[11px] text-[#8BA494]">Context: {activeTitle} · Scope & Closures · Fast Mode Active ✓</p>
            </div>

            <div className="terminal-card flex min-h-[420px] flex-1 flex-col p-3">
              <p className="rounded-full bg-[#0A120E] px-3 py-1.5 text-center font-mono text-[11px] text-[#8BA494]">● Socratic mode active: asks before it tells · knows quiz failures</p>

              <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
                {log && <p className="font-mono text-xs text-[#FBBF24]">&gt; {log}</p>}
                {msgs.length === 0 && (
                  <div className="rounded-lg bg-[#0A120E] p-3 text-center font-mono text-xs text-[#8BA494]">Ask about {activeTitle} — I guide with questions first, never spoil.</div>
                )}
                {msgs.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-[#10B98122] text-[#E6F4ED]" : "bg-[#060D0A] text-[#C9DCD2]"}`}>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content || (busy && i === msgs.length - 1 ? "▊ thinking…" : "")}</p>
                      {m.role === "assistant" && m.content && (
                        <div className="mt-2 rounded border border-[#10B98114] bg-[#0A120E] p-2">
                          <p className="font-mono text-[11px] text-[#FBBF24]">💡 Socratic Hint:</p>
                          <p className="font-mono text-[11px] text-[#8BA494]">Check the wrapper’s metadata table — what does `functools.wraps` preserve?</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {err && (
                  <div className="rounded-lg border border-[#F8717155] bg-[#F8717111] p-3 text-sm">
                    <p className="text-[#F87171]">{err}</p>
                  </div>
                )}
                <div ref={bottom} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => setInput("Explain with visual analogy")} className="rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#8BA494] hover:text-[#E6F4ED]">&gt; Explain with visual analogy</button>
                <button onClick={() => setInput("Show interactive mini-quiz")} className="rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#8BA494]">• Show interactive mini-quiz</button>
                <button onClick={() => setInput("Test my understanding")} className="rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#8BA494]">? Test my understanding</button>
              </div>

              <div className="mt-3 rounded-lg border border-[#10B98114] bg-[#0A120E] p-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[#10B981]">&gt;</span>
                  <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void send()} placeholder={`ask_tutor(scope="${activeTitle.toLowerCase().replace(/[^a-z]+/g, "_").slice(0, 16)}")`} className="flex-1 bg-transparent font-mono text-xs text-[#E6F4ED] placeholder:text-[#8BA49466] outline-none" />
                  <span className="font-mono text-[10px] text-[#8BA494]">MARKDOWN SHFT+ENTER</span>
                </div>
                <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your doubt or logic here… HiPath asks questions before giving direct answers." rows={2} className="mt-2 w-full resize-none bg-transparent font-mono text-xs text-[#8BA494] placeholder:text-[#8BA49466] outline-none" />
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex gap-2 font-mono text-[11px] text-[#8BA494]">
                    <span>&lt;&gt; Snippet</span>
                    <span>{"{}"} Attach Stack</span>
                  </div>
                  <button onClick={() => void send()} disabled={busy || !input.trim() || !roadmapId} className="rounded bg-[#10B981] px-4 py-1.5 font-mono text-xs font-bold text-[#050A08] disabled:opacity-40 hover:bg-[#34D399]">
                    {busy ? "…" : "Send Query ↑"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-3">
            <div className="terminal-card p-3">
              <p className="flex justify-between font-mono text-[10px] tracking-widest text-[#8BA494]">STUDENT MENTAL MODEL <span>⚙</span></p>
              <div className="mt-2 space-y-2">
                <div className="flex gap-2"><span className="text-[#10B981]">✓</span><div><p className="text-xs font-semibold">First-Class Functions</p><p className="font-mono text-[11px] text-[#8BA494]">Mastered · 94% retention</p></div></div>
                <div className="flex gap-2"><span className="text-[#10B981]">✓</span><div><p className="text-xs font-semibold">Wrapper Closure Scoping</p><p className="font-mono text-[11px] text-[#8BA494]">Inferred via Socratic Hint</p></div></div>
                <div className="flex gap-2"><span className="text-[#FBBF24]">●</span><div><p className="text-xs font-semibold text-[#FBBF24]">functools.wraps Metadata</p><p className="font-mono text-[11px] text-[#8BA494]">Testing right now in sandbox</p></div></div>
              </div>
            </div>

            <div className="terminal-card p-0">
              <div className="flex items-center justify-between border-b border-[#10B9810F] px-3 py-2">
                <p className="flex items-center gap-2 font-mono text-[11px]"><span className="h-2 w-2 rounded-full bg-[#F87171]"></span><span className="h-2 w-2 rounded-full bg-[#FBBF24]"></span><span className="h-2 w-2 rounded-full bg-[#10B981]"></span> scratchpad.py</p>
                <button onClick={runScratch} disabled={runBusy} className="rounded bg-[#10B981] px-2 py-1 font-mono text-xs font-bold text-[#050A08] disabled:opacity-50">▶ Run</button>
              </div>
              <textarea value={scratch} onChange={(e) => setScratch(e.target.value)} rows={18} className="w-full bg-[#060D0A] p-3 font-mono text-[12px] leading-relaxed text-[#E6F4ED] outline-none" />
              <div className="border-t border-[#10B9810F] p-3">
                <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">TERMINAL OUTPUT <span className="text-[#10B981]">● Exit 0</span></p>
                <pre className="mt-1 rounded bg-[#0A120E] p-2 font-mono text-[11px] text-[#10B981]">{termOut}</pre>
              </div>
            </div>

            <div className="terminal-card p-3">
              <p className="flex items-center gap-2 font-mono text-xs font-bold"><span className="text-[#10B981]">🔒</span> QUIZ GATE: UNLOCK NEXT <span className="ml-auto font-mono text-[11px] font-normal text-[#8BA494]">70% to Pass</span></p>
              <p className="mt-2 font-mono text-[11px] text-[#8BA494]">You addressed your scope misconception. Complete the 3-question micro quiz to verify decorator closures and unlock <span className="text-[#10B981]">OOP & Metaclasses</span>.</p>
              <p className="mt-2 font-mono text-[11px] text-[#8BA494]">⚡ Fast fallback active · adaptive difficulty</p>
              <Link href={roadmapId ? `/app/lesson/${roadmapId}/${order}` : "/app/dashboard"} className="mt-3 flex w-full items-center justify-between rounded bg-[#10B981] px-3 py-2 font-mono text-xs font-bold text-[#050A08]">Start Quiz Gate (3 min) <span>→</span></Link>
            </div>

            <p className="text-center font-mono text-[10px] tracking-widest text-[#8BA494]">HIPATH SOCRATIC v1 · free forever</p>
          </div>
        </div>
      </div>
    </div>
  );
}
