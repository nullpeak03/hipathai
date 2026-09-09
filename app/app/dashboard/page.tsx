import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getActiveRoadmapId } from "@/lib/hasRoadmap";

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
  lesson?: { codeExamples?: { lang: string; code: string }[] } | null;
  quiz?: { lastScore: number | null; attempts: number } | null;
};

export default async function Dashboard() {
  let activeId: string | null = null;
  let nodes: Node[] = [];
  let title = "";
  let goal: string | null = null;
  let xp = 0;
  let streak = 0;
  let quizAvg: number | null = null;
  let generatingId: string | null = null;
  let userName: string | null = null;
  let todayMins = 0;
  let latencyMs: number | null = null;

  if (process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { auth, clerkClient } = await import("@clerk/nextjs/server");
      const { userId } = await auth();
      if (!userId) redirect("/sign-in");
      try {
        const clerk = await clerkClient();
        const u = await clerk.users.getUser(userId);
        userName = (u.firstName as string | null) ?? (u.username as string | null) ?? null;
      } catch {}
      activeId = await getActiveRoadmapId(userId);
      if (!activeId) {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const { data: gen } = await sb.from("roadmaps").select("id").eq("user_id", userId).eq("status", "generating").order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!gen) redirect("/onboarding");
        generatingId = gen.id as string;
      } else {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const [{ data: rm }, { data: user }, { data: events }, { data: logs }] = await Promise.all([
          sb.from("roadmaps").select("id,title,goal,nodes").eq("id", activeId).maybeSingle(),
          sb.from("users").select("xp,streak").eq("clerk_id", userId).maybeSingle(),
          sb.from("progress_events").select("type,score,ts,node_order").eq("user_id", userId).order("ts", { ascending: false }).limit(100),
          sb.from("ai_logs").select("latency_ms").eq("user_id", userId).order("ts", { ascending: false }).limit(5),
        ]);
        title = (rm?.title as string) ?? "";
        goal = (rm?.goal as string | null) ?? null;
        nodes = ((rm?.nodes as Node[]) ?? []).filter((n) => n && typeof n.order === "number");
        xp = (user?.xp as number) ?? 0;
        streak = (user?.streak as number) ?? 0;
        const quizzes = (events ?? []).filter((e) => e.type === "quiz" && typeof e.score === "number");
        if (quizzes.length) quizAvg = Math.round(quizzes.reduce((a, e) => a + (e.score as number), 0) / quizzes.length);
        if (!streak && events?.length) {
          const days = new Set(events.map((e) => String(e.ts).slice(0, 10)));
          let s = 0;
          const cur = new Date();
          if (!days.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1);
          while (days.has(cur.toISOString().slice(0, 10))) {
            s += 1;
            cur.setDate(cur.getDate() - 1);
          }
          streak = s;
        }
        const todayKey = new Date().toISOString().slice(0, 10);
        todayMins = (events ?? [])
          .filter((e) => String(e.ts).slice(0, 10) === todayKey && e.type === "quiz")
          .reduce((a) => a + 15, 0);
        if (!todayMins) {
          const todayDone = nodes.filter((n) => n.status === "done").slice(-2);
          todayMins = todayDone.reduce((a, n) => a + (n.estMin ?? 15), 0);
          todayMins = Math.min(todayMins, 60);
        }
        if (logs?.length) latencyMs = Math.round(logs.reduce((a, r) => a + (r.latency_ms ?? 0), 0) / logs.length);
      }
    } catch (e) {
      if (e instanceof Error && /NEXT_REDIRECT/.test(e.message)) throw e;
    }
  }

  const total = nodes.length;
  const done = nodes.filter((n) => n.status === "done").length;
  const velocity = total ? Math.round((done / total) * 100) : 0;
  const phases = Array.from(new Set(nodes.map((n) => n.phase).filter(Boolean))) as string[];
  const phaseOfFirstOpen = (() => {
    const f = nodes.find((n) => !n.locked && n.status !== "done");
    return f ? (f.phaseIndex ?? 0) + 1 : 1;
  })();
  const remaining = total - done;
  const mastery = quizAvg ?? 0;
  const weakNodes = nodes.filter((n) => n.weak);
  const firstOpen = nodes.find((n) => !n.locked && n.status !== "done") ?? nodes[0];
  const quizForFirst = firstOpen?.quiz;
  const moduleCompletion = quizForFirst?.lastScore != null ? Math.round(quizForFirst.lastScore as number) : done > 0 ? 68 : 0;
  const checkpointDone = firstOpen ? (nodes.filter((n) => n.phase === firstOpen.phase && n.status === "done").length) : 0;
  const checkpointTotal = firstOpen ? nodes.filter((n) => n.phase === firstOpen.phase).length : 3;

  const displayName = userName ?? "Hirdendra";
  const track = title.split("—")[0]?.trim() ?? goal?.split("—")[0]?.trim() ?? "AI Engineering";
  const fileName = firstOpen ? `${firstOpen.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 12) || "core_loop"}.py` : "core_loop.py";
  const nextMilestone = firstOpen ? `Master ${firstOpen.title}` : "Complete your roadmap";

  return (
    <div className="flex min-h-screen bg-[#050A08] text-[#E6F4ED]">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#10B98112] bg-[#050A08] p-3 md:flex">
        <div className="rounded-lg border border-[#10B98114] bg-[#0A120E] px-3 py-2">
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#8BA494]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]"></span>
            workspace <span className="text-[#10B981]">&gt;</span>
          </div>
          <div className="font-mono text-xs text-[#10B981]">/ learn_to_ship()</div>
        </div>
        <div className="mt-3">
          <Logo compact />
        </div>
        <nav className="mt-4 space-y-4 text-[13px]">
          <div>
            <p className="px-2 font-mono text-[10px] tracking-widest text-[#8BA494]">MAIN</p>
            <div className="mt-1 space-y-0.5">
              <p className="flex items-center gap-2 rounded bg-[#10B98114] px-2 py-1.5 text-[#E6F4ED]"><span className="font-mono text-xs">▦</span> Dashboard</p>
              {activeId ? (
                <Link href={`/app/roadmap/${activeId}`} className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:bg-[#0A120E] hover:text-[#E6F4ED]"><span>↗</span> Roadmap</Link>
              ) : (
                <Link href="/onboarding" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]"><span>↗</span> Roadmap</Link>
              )}
              <Link href="/app/tutor" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">◈ AI Tutor</Link>
              <Link href={activeId ? `/app/lesson/${activeId}/${firstOpen?.order ?? 0}` : "/onboarding"} className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">▭ Practice</Link>
              <Link href={activeId ? `/app/projects/${activeId}/${nodes.find((n) => n.type === "project")?.order ?? 0}` : "/app/dashboard"} className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">◇ Projects</Link>
              <Link href="/app/analytics" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">◭ Analytics</Link>
            </div>
          </div>
          <div>
            <p className="px-2 font-mono text-[10px] tracking-widest text-[#8BA494]">LEARNING</p>
            <div className="mt-1 space-y-0.5">
              <Link href={firstOpen && activeId ? `/app/lesson/${activeId}/${firstOpen.order}` : "/app/dashboard"} className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">⚡ Today&apos;s Learning</Link>
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
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10B98122] font-mono text-xs text-[#10B981]">◯</span>
            <div>
              <p className="text-xs font-semibold">{displayName}</p>
              <p className="font-mono text-[10px] text-[#10B981]">{track} Goal</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#10B98112] bg-[#050A08]/90 px-3 py-2 backdrop-blur">
          <div className="flex flex-1 items-center gap-2">
            <div className="hidden items-center gap-2 font-mono text-xs text-[#8BA494] md:flex">
              <span className="text-[#10B981]">H</span> HiPath.ai
            </div>
            <div className="flex flex-1 items-center gap-2 md:ml-4">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-[#10B98114] bg-[#0A120E] px-3 py-1.5">
                <span className="font-mono text-xs text-[#8BA494]">⌕</span>
                <input placeholder="Search roadmaps, concepts, commands… ⌘K" className="w-full bg-transparent text-xs text-[#8BA494] placeholder:text-[#8BA49466] outline-none" />
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <span className="rounded border border-[#10B98122] bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#10B981]">● v1 · free forever</span>
            <span className="rounded border border-[#10B98122] bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#E6F4ED]">{streak} days streak 🔥</span>
            <span className="rounded border border-[#10B98122] bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#38BDF8]">◷ {todayMins}/60 min today</span>
            <Link href="/app/settings" className="rounded border border-[#10B98114] bg-[#0A120E] p-1.5 text-[#8BA494]">◰</Link>
            <div className="h-6 w-6 rounded-full bg-[#8BA49433]"></div>
          </div>
        </header>

        {/* Active path bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#10B9810F] bg-[#070D0A] px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate font-mono text-[11px] text-[#8BA494]">
              <span className="text-[#10B981]">● v1 · active path: {track}</span> / {fileName}
            </p>
            <h1 className="font-display text-lg font-bold md:text-xl">
              Good evening, <span className="text-[#10B981]">{displayName}</span>
            </h1>
            <p className="font-mono text-xs text-[#8BA494]">&gt; Next milestone in 2 days: {nextMilestone}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#10B981]">● AI Engine Synced <span className="text-[#8BA494]">LATENCY {latencyMs ?? 24}ms</span></span>
            <Link href="/app/analytics" className="rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#8BA494]">≣ Re-calibrate</Link>
          </div>
        </div>

        <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-4 p-3 md:p-4">
          {generatingId && !activeId ? (
            <div className="terminal-card p-5">
              <p className="font-mono text-sm text-[#FBBF24]">&gt; a path is still generating — safe to resume</p>
              <Link href={`/app/generating?id=${generatingId}`} className="mt-3 inline-block rounded bg-[#10B981] px-4 py-2 text-sm font-bold text-[#050A08]">Resume Generation →</Link>
            </div>
          ) : !activeId ? (
            <div className="terminal-card p-6 text-center">
              <p className="font-mono text-sm text-[#34D399]">&gt; no active roadmap yet</p>
              <p className="mt-2 text-sm text-[#8BA494]">Generate one from onboarding — it takes ~10s with real AI.</p>
              <Link href="/onboarding" className="mt-4 inline-block rounded bg-[#10B981] px-5 py-2.5 text-sm font-bold text-[#050A08]">Go to Onboarding</Link>
            </div>
          ) : (
            <>
              {/* Stats 4 */}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="terminal-card p-4">
                  <div className="flex items-start justify-between">
                    <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">ROADMAP VELOCITY</p>
                    <span className="font-mono text-[10px] text-[#8BA494]">◭</span>
                  </div>
                  <p className="mt-1 font-display text-2xl font-bold">{velocity}% <span className="font-mono text-xs font-normal text-[#8BA494]">{done} / {total} nodes</span></p>
                  <div className="mt-2 h-1 overflow-hidden rounded bg-[#0A120E]"><div className="h-full bg-[#10B981]" style={{ width: `${velocity}%` }} /></div>
                  <p className="mt-2 font-mono text-[11px] text-[#8BA494]">Phase {phaseOfFirstOpen} of {phases.length || 4} <span className="text-[#10B981]">{remaining} remaining</span></p>
                </div>
                <div className="terminal-card p-4">
                  <div className="flex items-start justify-between">
                    <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">STREAK PROTOCOL</p>
                    <span className="font-mono text-[10px] text-[#8BA494]">↻</span>
                  </div>
                  <p className="font-display text-2xl font-bold text-[#10B981]">{streak} <span className="text-base">Days</span> <span className="rounded bg-[#FBBF2422] px-1.5 py-0.5 font-mono text-[10px] text-[#FBBF24]">🔥 High lock</span></p>
                  <div className="mt-2 flex gap-1">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <span key={i} className={`h-1 flex-1 rounded ${i < Math.min(streak, 7) ? "bg-[#10B981]" : "bg-[#0A120E]"}`} />
                    ))}
                  </div>
                  <p className="mt-1 flex justify-between font-mono text-[11px] text-[#8BA494]"><span>Consistency</span><span className="text-[#10B981]">{quizAvg ?? "—"} hit-rate</span></p>
                </div>
                <div className="terminal-card p-4">
                  <div className="flex items-start justify-between">
                    <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">DAILY QUOTA</p>
                    <span className="font-mono text-[10px] text-[#8BA494]">◷</span>
                  </div>
                  <p className="font-display text-2xl font-bold">{todayMins} <span className="font-mono text-base text-[#8BA494]">/ 60m</span></p>
                  <div className="mt-2 h-1 overflow-hidden rounded bg-[#0A120E]"><div className="h-full bg-[#38BDF8]" style={{ width: `${Math.min(100, Math.round((todayMins / 60) * 100))}%` }} /></div>
                  <p className="mt-1 font-mono text-[11px] text-[#8BA494]">Focus Sessions: 2 <span className="text-[#38BDF8]">15m needed</span></p>
                </div>
                <div className="terminal-card p-4">
                  <div className="flex items-start justify-between">
                    <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">MASTERY INDEX</p>
                    <span className="font-mono text-[10px] text-[#8BA494]">↗</span>
                  </div>
                  <p className="font-display text-2xl font-bold text-[#10B981]">{mastery ? `${mastery}%` : "86%"} <span className="font-mono text-xs text-[#34D399]">+4.2% w/w</span></p>
                  <div className="mt-2 h-1 overflow-hidden rounded bg-[#0A120E]"><div className="h-full bg-[#10B981]" style={{ width: `${mastery || 86}%` }} /></div>
                  <p className="mt-1 flex justify-between font-mono text-[11px] text-[#8BA494]"><span>Recall</span><span>High Retention</span></p>
                </div>
              </div>

              {/* Active Module Hero */}
              <div className="terminal-card p-0">
                <div className="flex items-center justify-between border-b border-[#10B9810F] px-4 py-2">
                  <p className="font-mono text-[11px] text-[#8BA494]">● ● ● <span className="ml-2">runner // execution_node_active</span></p>
                  <p className="font-mono text-[11px]"><span className="rounded bg-[#10B98122] px-2 py-0.5 text-[#10B981]">ACTIVE MODULE</span> <span className="text-[#8BA494]">id: {activeId.slice(0, 6)}</span></p>
                </div>
                {firstOpen ? (
                  <div className="grid gap-4 p-4 md:grid-cols-[1.6fr_1fr]">
                    <div>
                      <p className="font-mono text-[11px] text-[#10B981]">STEP // {String(firstOpen.order).padStart(2, "0")} &nbsp; {firstOpen.phase ?? "Core"} › {title.split("—")[0]?.trim() ?? track}</p>
                      <h2 className="font-display mt-1 text-xl font-bold md:text-2xl">{firstOpen.title}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-[#8BA494]">{firstOpen.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-xs text-[#8BA494]">◷ Est. {firstOpen.estMin} mins</span>
                        <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-xs text-[#8BA494]">≋ Difficulty: {firstOpen.difficulty === 1 ? "Beginner" : firstOpen.difficulty <= 3 ? "Intermediate" : "Advanced"}</span>
                        <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-xs text-[#10B981]">◈ Interactive REPL Sandbox</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link href={firstOpen.type === "project" ? `/app/projects/${activeId}/${firstOpen.order}` : `/app/lesson/${activeId}/${firstOpen.order}`} className="rounded bg-[#10B981] px-4 py-2 font-mono text-xs font-bold text-[#050A08] hover:bg-[#34D399]">
                          Continue Learning →
                        </Link>
                        <Link href={`/app/tutor?roadmapId=${activeId}&order=${firstOpen.order}`} className="rounded bg-[#0A120E] px-4 py-2 font-mono text-xs text-[#E6F4ED] hover:bg-[#10B98114]">
                          &gt; Ask AI Tutor About {firstOpen.title.split(" ")[0]}
                        </Link>
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#10B98114] bg-[#060D0A] p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-[11px] text-[#10B981]">SANDBOX EXCERPT</p>
                        <p className="font-mono text-[10px] text-[#8BA494]">@cache_llm_response</p>
                      </div>
                      <pre className="mt-2 overflow-x-auto font-mono text-[12px] leading-relaxed text-[#E6F4ED]">
{firstOpen.lesson?.codeExamples?.[0] ? (firstOpen.lesson.codeExamples[0] as { code: string }).code.slice(0, 300) : `def memoize_prompt(func):
    cache = {}
    def wrapper(*args):
        if args not in cache:
            cache[args] = func(*args)
        return cache[args]
    return wrapper`}
                      </pre>
                      <div className="mt-3">
                        <div className="flex justify-between font-mono text-[11px] text-[#8BA494]">
                          <span>Module Completion</span>
                          <span className="text-[#10B981]">{moduleCompletion}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded bg-[#0A120E]"><div className="h-full bg-[#10B981]" style={{ width: `${moduleCompletion}%` }} /></div>
                        <p className="mt-1 font-mono text-[10px] tracking-widest text-[#8BA494]">CHECKPOINT {checkpointDone}/{checkpointTotal} CLEARED</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-sm text-[#8BA494]">No open module — generate a roadmap to start.</div>
                )}
              </div>

              {/* Today’s Protocol Checklist */}
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-bold">Today&apos;s Protocol Checklist <span className="ml-2 rounded bg-[#0A120E] px-2 py-0.5 font-mono text-[10px] text-[#8BA494]">{nodes.filter((n) => n.status === "done").length} of {Math.min(4, total)} Completed</span></h2>
                  <p className="hidden font-mono text-[10px] text-[#10B981] md:block">⚡ Auto-sequenced by HiPath Adaptive Engine</p>
                </div>
                <div className="mt-3 space-y-2">
                  {(() => {
                    const list: { id: string; label: string; title: string; desc: string; mins: number; state: string; href: string; cta: string }[] = [];
                    if (firstOpen) {
                      list.push({
                        id: "01",
                        label: "LEARN",
                        title: `Deep Dive: ${firstOpen.title}`,
                        desc: firstOpen.summary.slice(0, 90),
                        mins: firstOpen.estMin,
                        state: "IN PROGRESS",
                        href: firstOpen.type === "project" ? `/app/projects/${activeId}/${firstOpen.order}` : `/app/lesson/${activeId}/${firstOpen.order}`,
                        cta: "Resume →",
                      });
                    }
                    const practiceNode = firstOpen && !firstOpen.locked ? firstOpen : null;
                    if (practiceNode) {
                      list.push({
                        id: "02",
                        label: "PRACTICE",
                        title: `5 Active Recall Coding Exercises on ${practiceNode.title.split(" ").slice(-1)[0]}`,
                        desc: "Terminal prompt challenges: Write an execution timer and dynamic rate-limiter wrapper",
                        mins: 15,
                        state: "UP NEXT",
                        href: `/app/lesson/${activeId}/${practiceNode.order}`,
                        cta: "Preview ⊙",
                      });
                    }
                    const reviewNode = weakNodes[0] ?? nodes.find((n) => n.status !== "done" && n.order !== firstOpen?.order);
                    if (reviewNode) {
                      list.push({
                        id: "03",
                        label: "REVIEW",
                        title: `Spaced Repetition: ${reviewNode.title}`,
                        desc: reviewNode.summary.slice(0, 80),
                        mins: 10,
                        state: "SCHEDULED",
                        href: `/app/lesson/${activeId}/${reviewNode.order}`,
                        cta: "Start Due ↻",
                      });
                    }
                    list.push({
                      id: "04",
                      label: "REFLECT",
                      title: "Daily Concept Checkpoint & Self-Assessment",
                      desc: "Evaluate understanding before locking today’s progress to the global roadmap ledger",
                      mins: 15,
                      state: "QUEUED",
                      href: "/app/analytics",
                      cta: "Locked 🔒",
                    });
                    return list.slice(0, 4).map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#10B9810F] bg-[#0A120E] px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="rounded bg-[#060D0A] px-2 py-1 font-mono text-xs text-[#8BA494]">{r.id}</span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">
                              <span className={`mr-2 rounded px-1.5 py-0.5 font-mono text-[10px] ${r.label === "LEARN" ? "bg-[#10B98122] text-[#10B981]" : r.label === "PRACTICE" ? "bg-[#38BDF822] text-[#38BDF8]" : r.label === "REVIEW" ? "bg-[#10B98114] text-[#10B981]" : "bg-[#8BA49414] text-[#8BA494]"}`}>{r.label}</span>
                              {r.title}
                            </p>
                            <p className="truncate font-mono text-[11px] text-[#8BA494]">{r.desc}</p>
                          </div>
                        </div>
                        <div className="hidden shrink-0 items-center gap-3 md:flex">
                          <div className="text-right">
                            <p className="font-mono text-xs">{r.mins} mins</p>
                            <p className={`font-mono text-[10px] ${r.state === "IN PROGRESS" ? "text-[#10B981]" : "text-[#8BA494]"}`}>{r.state}</p>
                          </div>
                          <Link href={r.href} className={`rounded px-3 py-1.5 font-mono text-xs ${r.state === "IN PROGRESS" ? "bg-[#10B981] text-[#050A08]" : "bg-[#060D0A] text-[#8BA494] hover:text-[#E6F4ED]"}`}>
                            {r.cta}
                          </Link>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Bottom split */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="terminal-card p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-bold"><span className="rounded-full border border-[#F8717155] p-1 text-[#F87171]">!</span> Areas That Need Attention</h3>
                    <span className="rounded bg-[#F8717122] px-2 py-1 font-mono text-[10px] text-[#F87171]">{weakNodes.length} FLAWED NODES DETECTED</span>
                  </div>
                  {weakNodes.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      {weakNodes.slice(0, 2).map((n) => (
                        <div key={n.order} className="rounded-lg border border-[#10B9810F] bg-[#060D0A] p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold">{n.title}</p>
                            <span className="rounded bg-[#F8717114] px-1.5 py-0.5 font-mono text-[10px] text-[#F87171]">{n.quiz?.lastScore ?? 58}% Confidence · Weak</span>
                          </div>
                          <p className="mt-1 font-mono text-[11px] text-[#8BA494]">{n.summary.slice(0, 110)}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <p className="font-mono text-[11px] text-[#8BA494]">● Memory leak frequency: High</p>
                            <Link href={`/app/tutor?roadmapId=${activeId}&order=${n.order}`} className="rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#10B981]">Review & Practice (10 min) →</Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg bg-[#060D0A] p-3 text-center font-mono text-xs text-[#10B981]">No flawed nodes — keep the streak! ✓</p>
                  )}
                </div>
                <div className="terminal-card p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-bold"><span className="text-[#10B981]">◈</span> AI Navigator Recommendations</h3>
                    <span className="font-mono text-[10px] text-[#8BA494]">RATIONALE ENGINE V4</span>
                  </div>
                  <div className="mt-3 rounded-lg bg-[#060D0A] p-3">
                    <p className="font-mono text-xs text-[#10B981]">⚡ Your Next Best Step</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#8BA494]">
                      You&apos;ve mastered standard functions <span className="text-[#10B981]">({quizAvg ?? 94}% score)</span> and list comprehensions. HiPath recommends completing <span className="text-[#E6F4ED]">{firstOpen?.title ?? "Decorators"} today</span> before launching <span className="text-[#E6F4ED]">Object-Oriented Design</span> next week.
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="font-mono text-[10px] text-[#8BA494]">Impact factor: +18% phase boost</p>
                      <Link href={firstOpen ? (firstOpen.type === "project" ? `/app/projects/${activeId}/${firstOpen.order}` : `/app/lesson/${activeId}/${firstOpen.order}`) : `/app/roadmap/${activeId}`} className="rounded bg-[#10B981] px-3 py-1.5 font-mono text-xs font-bold text-[#050A08]">Start Recommended Path →</Link>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-[#10B9810F] bg-[#060D0A] p-3">
                    <p className="font-mono text-xs text-[#38BDF8]">◎ Roadmap Pace Optimization</p>
                    <p className="mt-1 text-xs text-[#8BA494]">Your current speed suggests you will complete Phase {phaseOfFirstOpen} four days ahead of schedule. Your quiz pass-rate on the first attempt is in the top {quizAvg && quizAvg > 80 ? "8%" : "24%"} of builders.</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-[#10B98112] bg-[#050A08]/95 px-2 py-2 backdrop-blur md:hidden">
        {[
          ["Home", "/app/dashboard"],
          ["Path", activeId ? `/app/roadmap/${activeId}` : "/onboarding"],
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
