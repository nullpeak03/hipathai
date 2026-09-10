import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Node = {
  order: number;
  phase?: string;
  phaseIndex?: number;
  type: string;
  title: string;
  summary: string;
  difficulty: number;
  estMin: number;
  locked: boolean;
  status: string;
  weak: boolean;
  quiz?: { lastScore: number | null } | null;
};

export default async function RoadmapView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let title = "";
  let goal: string | null = null;
  let nodes: Node[] = [];
  let draft: Record<string, unknown> | null = null;
  let error = "";
  let userStreak = 0;
  let totalScore: number | null = null;

  if (process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { auth } = await import("@clerk/nextjs/server");
      const { userId } = await auth();
      if (!userId) redirect("/sign-in");
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data, error: err } = await sb.from("roadmaps").select("id,title,goal,nodes,draft").eq("id", id).eq("user_id", userId).maybeSingle();
      if (err) error = err.message;
      else if (!data) error = "Not found";
      else {
        title = (data.title as string) ?? (data.goal as string) ?? "Your path";
        goal = data.goal as string | null;
        draft = data.draft as Record<string, unknown> | null;
        nodes = ((data.nodes as Node[]) ?? []).filter((n) => n && typeof n.order === "number");
      }
      const [{ data: user }, { data: events }] = await Promise.all([
        sb.from("users").select("streak").eq("clerk_id", userId).maybeSingle(),
        sb.from("progress_events").select("score").eq("user_id", userId).eq("type", "quiz"),
      ]);
      userStreak = (user?.streak as number) ?? 0;
      if (events?.length) totalScore = Math.round(events.reduce((a, e) => a + (e.score as number), 0) / events.length);
    } catch (e) {
      if (e instanceof Error && /NEXT_REDIRECT/.test(e.message)) throw e;
      error = e instanceof Error ? e.message : "Failed";
    }
  } else {
    error = "Server store not configured yet.";
  }

  const total = nodes.length;
  const done = nodes.filter((n) => n.status === "done").length;
  const velocity = total ? Math.round((done / total) * 100) : 0;
  const activeNode = nodes.find((n) => !n.locked && n.status !== "done") ?? nodes.find((n) => n.status === "done") ?? nodes[0];
  const track = (draft as { track?: string } | null)?.track ?? title.split("—")[0]?.trim() ?? "Production AI Engineer";
  const deadline = (draft as { deadline?: string } | null)?.deadline ?? "July 18";
  const hrsPerDay = (draft as { hrsPerDay?: number } | null)?.hrsPerDay ?? 1.5;

  const phasesMap = new Map<string, Node[]>();
  nodes.forEach((n) => {
    const p = n.phase ?? `Phase ${n.phaseIndex ?? 0}`;
    if (!phasesMap.has(p)) phasesMap.set(p, []);
    phasesMap.get(p)!.push(n);
  });
  const phases = Array.from(phasesMap.entries());

  return (
    <div className="flex min-h-screen bg-[#050A08] text-[#E6F4ED]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#10B98112] bg-[#050A08] p-3 md:flex">
        <div className="rounded-lg border border-[#10B98114] bg-[#0A120E] px-3 py-2">
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#8BA494]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></span> workspace <span className="text-[#10B981]">&gt;</span>
          </div>
          <div className="font-mono text-xs text-[#10B981]">/ learn_to_ship()</div>
        </div>
        <nav className="mt-4 space-y-4 text-[13px]">
          <div>
            <p className="px-2 font-mono text-[10px] tracking-widest text-[#8BA494]">MAIN</p>
            <div className="mt-1 space-y-0.5">
              <Link href="/app/dashboard" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:bg-[#0A120E] hover:text-[#E6F4ED]">▦ Dashboard</Link>
              <p className="flex items-center gap-2 rounded bg-[#10B98114] px-2 py-1.5 text-[#E6F4ED]">↗ Roadmap</p>
              <Link href="/app/tutor" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">◈ AI Tutor</Link>
              <Link href={id ? `/app/lesson/${id}/${activeNode?.order ?? 0}` : "/app/dashboard"} className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">▭ Practice</Link>
              <Link href="/app/dashboard" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">◇ Projects</Link>
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
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-[#10B98112] bg-[#050A08]/90 px-3 py-2 backdrop-blur">
          <div className="flex items-center gap-2 font-mono text-xs text-[#8BA494]">
            <span className="hidden md:inline"><span className="text-[#10B981]">H</span> HiPath.ai</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded border border-[#10B98122] bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#10B981] md:block">● v1 · free forever</span>
            <span className="hidden rounded border border-[#10B98122] bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#E6F4ED] md:block">{userStreak || 14} days streak 🔥</span>
            <span className="hidden rounded border border-[#10B98122] bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#38BDF8] md:block">◷ 42/60 min today</span>
            <span className="rounded border border-[#10B98114] bg-[#0A120E] p-1.5 text-[#8BA494]">◰</span>
            <div className="h-6 w-6 rounded-full bg-[#8BA49433]"></div>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#10B9810F] bg-[#070D0A] px-3 py-2">
          <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#8BA494]">PATHWAY // PRODUCTION-AI-ENG-V2.4</span>
          <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#10B981]">● Accelerated · {hrsPerDay}h/day</span>
          <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#38BDF8]">↗ runtime_sync_ok</span>
          <span className="ml-auto flex items-center gap-2">
            <Link href="/app/settings" className="rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#8BA494]">≣ Edit Parameters</Link>
            <Link href={`/app/roadmap/${id}`} className="rounded bg-[#10B981] px-3 py-1 font-mono text-[11px] font-bold text-[#050A08]">↻ Recalibrate Path</Link>
          </span>
        </div>

        <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-3 p-3 md:p-4">
          {error ? (
            <div className="terminal-card border-[#F8717155] p-4">
              <p className="text-sm text-[#F87171]">{error}</p>
              <div className="mt-3 flex gap-2">
                <Link href="/app/generating" className="rounded bg-[#10B981] px-4 py-2 text-sm font-bold text-[#050A08]">Retry Now</Link>
                <Link href="/onboarding" className="rounded border border-[#10B98133] px-4 py-2 text-sm">Back to Summary</Link>
              </div>
            </div>
          ) : (
            <>
              <div className="terminal-card p-4">
                <p className="font-mono text-[10px] tracking-widest text-[#10B981]">ACTIVE SPECIALIZATION TRACK · Q2 2025 Objective</p>
                <div className="mt-2 grid gap-4 md:grid-cols-[1.6fr_auto_auto_auto]">
                  <div>
                    <h1 className="font-display text-xl font-bold md:text-2xl">Goal: {title || goal || "Become a Production AI Engineer"}</h1>
                    <p className="mt-1 text-sm text-[#8BA494]">Synthesizing high-throughput Python systems, discrete linear algebra, tensor abstractions, and autonomous multi-agent microservices into deployable portfolio artifacts.</p>
                  </div>
                  <div className="rounded bg-[#0A120E] p-3 text-center">
                    <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">MASTERY {done}/{total} Nodes</p>
                    <p className="font-display text-xl font-bold text-[#10B981]">{velocity}%</p>
                    <div className="mt-1 h-1 rounded bg-[#0A120E]"><div className="h-full bg-[#10B981]" style={{ width: `${velocity}%` }} /></div>
                  </div>
                  <div className="rounded bg-[#0A120E] p-3 text-center">
                    <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">CADENCE</p>
                    <p className="font-display text-xl font-bold text-[#10B981]">+8d</p>
                    <p className="font-mono text-[11px] text-[#8BA494]">Ahead of plan</p>
                  </div>
                  <div className="rounded bg-[#0A120E] p-3 text-center">
                    <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">TARGET</p>
                    <p className="font-display text-xl font-bold">{String(deadline).slice(0, 10) || "July 18"}</p>
                    <p className="font-mono text-[11px] text-[#8BA494]">Production Ready</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#10B98114] bg-[#0A120E] p-2">
                <span className="rounded bg-[#10B98122] px-2 py-1 font-mono text-[11px] text-[#10B981]">◈ AI Adaptation Applied · Yesterday, 9:30 PM</span>
                <span className="font-mono text-[11px] text-[#8BA494]">Roadmap dynamically restructured. Your <span className="text-[#10B981]">96% mastery in Data Structures</span> compressed syntax review by 3 days. Recursion call-stack weakness injected into immediate spaced-repetition queue.</span>
                <Link href="/app/analytics" className="ml-auto rounded bg-[#060D0A] px-2 py-1 font-mono text-[11px] text-[#10B981]">Inspect Logic →</Link>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.7fr_1fr]">
                <div className="space-y-3">
                  {phases.slice(0, 1).map(([phaseTitle, phaseNodes]) => {
                    const phaseDone = phaseNodes.filter((n) => n.status === "done").length;
                    const phasePct = phaseNodes.length ? Math.round((phaseDone / phaseNodes.length) * 100) : 0;
                    const activePhaseNode = phaseNodes.find((n) => !n.locked && n.status !== "done") ?? phaseNodes[0];
                    return (
                      <div key={phaseTitle} className="terminal-card p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#10B981] font-mono text-xs font-bold text-[#10B981]">{phasePct}%</span>
                            <div>
                              <p className="font-mono text-[10px] tracking-widest text-[#10B981]">PHASE 01 <span className="rounded bg-[#10B98122] px-1 py-0.5">IN PROGRESS</span></p>
                              <p className="font-display text-sm font-bold">{phaseTitle}</p>
                            </div>
                          </div>
                          <p className="font-mono text-[11px] text-[#8BA494]">≣ 28 of 40 Core Concepts Validated</p>
                        </div>
                        <div className="mt-3 space-y-2">
                          {phaseNodes.map((n) => {
                            const isDone = n.status === "done";
                            const isActive = activePhaseNode?.order === n.order;
                            const isLocked = n.locked;
                            return (
                              <div key={n.order} className={`flex items-start gap-3 rounded-lg border p-3 ${isActive ? "border-[#10B98133] bg-[#10B98108]" : isDone ? "border-[#10B98114] bg-[#0A120E]" : isLocked ? "border-[#8BA49414] bg-[#070D0A] opacity-60" : "border-[#10B98114] bg-[#0A120E]"}`}>
                                <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${isDone ? "bg-[#10B981]" : isActive ? "bg-[#10B981] shadow-[0_0_6px_#10B981]" : isLocked ? "bg-[#8BA494]" : "bg-[#F87171]"}`} />
                                <div className="min-w-0 flex-1">
                                  <p className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                                    <span className="text-[#8BA494]">NODE 01.{n.order}</span>
                                    {isDone && <span className="rounded bg-[#10B98122] px-1 py-0.5 text-[#10B981]">● DONE Score: {n.quiz?.lastScore ?? 98}% Mastery</span>}
                                    {isActive && <span className="rounded bg-[#10B981] px-1 py-0.5 text-[#050A08]">● ACTIVE NOW</span>}
                                    {n.weak && <span className="rounded bg-[#F8717122] px-1 py-0.5 text-[#F87171]">■ REMEDIAL QUEUE</span>}
                                    {isLocked && <span className="rounded bg-[#8BA49422] px-1 py-0.5 text-[#8BA494]">● LOCKED</span>}
                                  </p>
                                  <p className="mt-1 font-display text-sm font-semibold">{n.title}</p>
                                  <p className="font-mono text-[11px] text-[#8BA494]">{n.summary}</p>
                                  {!isLocked && !isDone && <p className="mt-1 font-mono text-[11px] text-[#10B981]">◷ ~{n.estMin} min remaining · 14 unit exercises complete</p>}
                                </div>
                                {isActive ? (
                                  <Link href={n.type === "project" ? `/app/projects/${id}/${n.order}` : `/app/lesson/${id}/${n.order}`} className="shrink-0 rounded bg-[#10B981] px-3 py-1.5 font-mono text-xs font-bold text-[#050A08]">▶ Resume Lesson</Link>
                                ) : isDone ? (
                                  <span className="font-mono text-xs text-[#8BA494]">👁</span>
                                ) : n.weak ? (
                                  <Link href={`/app/lesson/${id}/${n.order}`} className="shrink-0 rounded bg-[#F8717114] px-2 py-1 font-mono text-xs text-[#F87171]">↻ Re-test Drill</Link>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#10B98114] bg-[#0A120E] p-2">
                          <span className="rounded bg-[#10B98122] p-1.5 font-mono text-xs text-[#10B981]">▭</span>
                          <div>
                            <p className="font-mono text-xs font-bold">PHASE 01 ARTIFACT Pass Threshold: 70%</p>
                            <p className="font-mono text-[11px] text-[#8BA494]">CLI Task Automator with Custom Decorators & Telemetry</p>
                          </div>
                          <Link href={activeNode ? `/app/projects/${id}/${activeNode.order}` : `/app/dashboard`} className="ml-auto font-mono text-xs text-[#10B981]">View Brief & Rubric ⊡</Link>
                        </div>
                      </div>
                    );
                  })}
                  {phases.slice(1, 2).map(([phaseTitle, phaseNodes]) => (
                    <div key={phaseTitle} className="terminal-card p-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-xs font-bold text-[#10B981]">02</span>
                        <div>
                          <p className="font-mono text-[10px] tracking-widest text-[#38BDF8]">PHASE 02 UNLOCKED · STARTS IN ~6 DAYS</p>
                          <p className="font-display text-sm font-bold">{phaseTitle}</p>
                        </div>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-[#8BA494]">{phaseNodes.length} Deep Modules · 22h Estimated Effort</p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {phaseNodes.slice(0, 4).map((n) => (
                          <Link key={n.order} href={n.locked ? `/app/roadmap/${id}` : n.type === "project" ? `/app/projects/${id}/${n.order}` : `/app/lesson/${id}/${n.order}`} className={`rounded-lg border p-3 ${n.locked ? "border-[#10B9810F] bg-[#0A120E] opacity-80" : "border-[#10B98114] bg-[#0A120E] hover:border-[#10B981]"}`}>
                            <p className="flex justify-between font-mono text-[10px]"><span className="text-[#8BA494]">NODE 02.{n.order}</span><span className={n.locked ? "text-[#8BA494]" : "text-[#10B981]"}>{n.locked ? "QUEUED" : "READY"}</span></p>
                            <p className="mt-1 font-display text-xs font-bold">{n.title}</p>
                            <p className="font-mono text-[11px] text-[#8BA494]">{n.summary.slice(0, 80)}</p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                  {phases.slice(2).map(([phaseTitle], idx) => (
                    <div key={phaseTitle} className="terminal-card flex items-center gap-3 p-3 opacity-60">
                      <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-xs">0{3 + idx}</span>
                      <div>
                        <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">PHASE 0{3 + idx} · LOCKED</p>
                        <p className="font-display text-sm font-bold">{phaseTitle}</p>
                      </div>
                      <span className="ml-auto text-[#8BA494]">🔒</span>
                    </div>
                  ))}
                  <div className="terminal-card flex items-center gap-3 p-3 opacity-60">
                    <span className="rounded bg-[#0A120E] p-2">⚑</span>
                    <div>
                      <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">FINAL CAPSTONE REQUIREMENT</p>
                      <p className="font-display text-sm font-bold">Autonomous Multi-Agent AI Research Assistant</p>
                      <p className="font-mono text-[11px] text-[#8BA494]">Full production deployment with LangGraph, FastAPI, Redis vector cache, and latency SLA benchmarks.</p>
                    </div>
                    <span className="ml-auto font-mono text-xs text-[#8BA494]">380 pts</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="terminal-card p-3">
                    <p className="flex justify-between font-mono text-[10px] tracking-widest text-[#8BA494]">ACTIVE CONCEPT TELEMETRY <span>NODE // 01.3</span></p>
                    <h3 className="mt-2 font-display text-sm font-bold">Functions, Closures & Higher-Order Decorators</h3>
                    <p className="font-mono text-[11px] text-[#8BA494]">Key architecture requirement for FastAPI middleware, PyTorch loss decorators, and LangChain tool dispatchers.</p>
                    <div className="mt-3">
                      <div className="flex justify-between font-mono text-[11px]"><span className="text-[#8BA494]">Calculated Mastery</span><span className="text-[#10B981]">74% · Proficient</span></div>
                      <div className="mt-1 h-1.5 rounded bg-[#0A120E]"><div className="h-full bg-[#10B981]" style={{ width: "74%" }} /></div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded bg-[#0A120E] p-2 text-center"><p className="font-mono text-[10px] text-[#8BA494]">CONFIDENCE INDEX</p><p className="font-mono text-xs font-bold text-[#38BDF8]">0.88 High</p></div>
                        <div className="rounded bg-[#0A120E] p-2 text-center"><p className="font-mono text-[10px] text-[#8BA494]">DRILLS SOLVED</p><p className="font-mono text-xs font-bold">12 / 16</p></div>
                      </div>
                    </div>
                    <p className="mt-2 font-mono text-[10px] tracking-widest text-[#8BA494]">DOWNSTREAM DEPENDENCIES (LINKED 3)</p>
                    <div className="mt-1 space-y-1">
                      {["OOP Protocols & Abstract Classes", "FastAPI Middleware & Interceptors", "LangChain Custom Tool Wrappers"].map((d) => (
                        <p key={d} className="flex justify-between rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#8BA494]"><span>→ {d}</span><span className="text-[#8BA494]">Phase 2</span></p>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Link href={`/app/tutor?roadmapId=${id}&order=${activeNode?.order ?? 0}`} className="rounded bg-[#10B981] px-3 py-2 text-center font-mono text-xs font-bold text-[#050A08]">◎ Open in AI Tutor</Link>
                      <Link href={activeNode ? `/app/lesson/${id}/${activeNode.order}` : "/app/dashboard"} className="rounded bg-[#0A120E] px-3 py-2 text-center font-mono text-xs text-[#E6F4ED]">◈ Take Quick 3-Min Quiz</Link>
                    </div>
                    <div className="mt-3 rounded-lg border border-[#10B98114] bg-[#0A120E] p-2">
                      <p className="flex justify-between font-mono text-[10px]"><span className="text-[#8BA494]">WEEKLY PACE TELEMETRY</span><span className="text-[#10B981]">+18% vs Peers</span></p>
                      <div className="mt-1 h-1 rounded bg-[#050A08]"><div className="h-full w-[80%] bg-[#10B981]" /></div>
                      <p className="mt-1 flex justify-between font-mono text-[10px] text-[#8BA494]"><span>Streak: {userStreak || 14} Days 🔥</span><span>Avg: {totalScore ?? 1.6}h / day</span></p>
                    </div>
                    <div className="mt-3 rounded bg-[#0A120E] p-2">
                      <p className="flex justify-between font-mono text-[10px]"><span className="text-[#8BA494]">CALIBRATION TERMINAL</span><span className="text-[#10B981]">live</span></p>
                      <p className="font-mono text-[11px] text-[#10B981]">&gt; [21:30] Recursion gap detected via…</p>
                      <p className="font-mono text-[11px] text-[#38BDF8]">&gt; [18:14] Verified mastery for Python…</p>
                      <p className="font-mono text-[11px] text-[#8BA494]">&gt; [11:02] Phase 02 schedule calibrat…</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-[#10B98112] bg-[#050A08]/95 px-2 py-2 backdrop-blur md:hidden">
        {[
          ["Home", "/app/dashboard"],
          ["Path", `/app/roadmap/${id}`],
          ["Tutor", "/app/tutor"],
          ["Stats", "/app/analytics"],
          ["You", "/app/profile"],
        ].map(([label, href]) => (
          <Link key={label} href={href} className="flex-1 rounded-lg px-2 py-2 text-center text-xs text-[#8BA494] hover:text-[#E6F4ED]">
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
