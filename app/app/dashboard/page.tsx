import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getActiveRoadmapId } from "@/lib/hasRoadmap";

export const dynamic = "force-dynamic";

type Node = {
  order: number; type: string; title: string; locked: boolean; status: string; weak: boolean;
};

export default async function Dashboard() {
  // Server guard per plan.md §2: session + 0 ready -> /onboarding.
  // Keyless-safe: without Clerk/Supabase envs, render the onboarding CTA shell.
  let activeId: string | null = null;
  let nodes: Node[] = [];
  let title = "";
  let xp = 0;
  let streak = 0;
  let quizAvg: string = "—";
  let generatingId: string | null = null;

  if (process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { auth } = await import("@clerk/nextjs/server");
      const { userId } = await auth();
      if (!userId) redirect("/sign-in");
      activeId = await getActiveRoadmapId(userId);
      if (!activeId) {
        // Resume-after-tab-close: still generating? banner, else onboarding.
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );
        const { data: gen } = await sb
          .from("roadmaps")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "generating")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!gen) redirect("/onboarding");
        generatingId = gen.id as string;
      } else {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );
        const [{ data: rm }, { data: user }, { data: events }] = await Promise.all([
          sb.from("roadmaps").select("id,title,nodes").eq("id", activeId).maybeSingle(),
          sb.from("users").select("xp,streak").eq("clerk_id", userId).maybeSingle(),
          sb.from("progress_events").select("type,score,ts").eq("user_id", userId).order("ts", { ascending: false }).limit(50),
        ]);
        title = (rm?.title as string) ?? "";
        nodes = ((rm?.nodes as Node[]) ?? []).filter((n) => n && typeof n.order === "number");
        xp = (user?.xp as number) ?? 0;
        streak = (user?.streak as number) ?? 0;
        const quizzes = (events ?? []).filter((e) => e.type === "quiz" && typeof e.score === "number");
        if (quizzes.length) {
          quizAvg = `${Math.round(quizzes.reduce((a, e) => a + (e.score as number), 0) / quizzes.length)}%`;
        }
        // Streak fallback from events if users.streak unset
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
      }
    } catch (e) {
      if (e instanceof Error && /NEXT_REDIRECT/.test(e.message)) throw e;
      // Fall through to shell on store errors — generating retry covers recovery
    }
  }

  const open = nodes.filter((n) => n.status !== "done").slice(0, 3);
  const weak = nodes.filter((n) => n.weak).slice(0, 5);
  const firstOpen = nodes.find((n) => !n.locked && n.status !== "done") ?? nodes[0];

  return (
    <div className="flex min-h-screen bg-[#050A08] text-[#E6F4ED]">
      <aside className="hidden w-64 flex-col border-r border-[#10B98122] p-4 md:flex">
        <Logo compact />
        <nav className="mt-6 space-y-1 text-sm">
          <p className="rounded-lg bg-[#10B98122] px-3 py-2">Dashboard</p>
          {activeId && <Link href={`/app/roadmap/${activeId}`} className="block rounded-lg px-3 py-2 text-[#8BA494] hover:text-[#E6F4ED]">My Path</Link>}
          <Link href="/app/tutor" className="block rounded-lg px-3 py-2 text-[#8BA494] hover:text-[#E6F4ED]">Tutor</Link>
          <Link href="/app/analytics" className="block rounded-lg px-3 py-2 text-[#8BA494] hover:text-[#E6F4ED]">Analytics</Link>
          <Link href="/app/profile" className="block rounded-lg px-3 py-2 text-[#8BA494] hover:text-[#E6F4ED]">Profile</Link>
          <Link href="/app/settings" className="block rounded-lg px-3 py-2 text-[#8BA494] hover:text-[#E6F4ED]">Settings</Link>
        </nav>
        <div className="terminal-card mt-auto p-3 font-mono text-xs text-[#8BA494]">
          streak {streak}d · XP {xp} · quiz avg {quizAvg}
        </div>
      </aside>
      <main className="flex-1 p-6 pb-20 md:pb-6">
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        {generatingId && !activeId ? (
          <div className="terminal-card mt-6 p-5">
            <p className="font-mono text-sm text-[#FBBF24]">&gt; a path is still generating — safe to resume</p>
            <Link href={`/app/generating?id=${generatingId}`} className="mt-4 inline-block rounded-lg bg-[#10B981] px-5 py-2.5 text-sm font-semibold text-[#050A08] hover:bg-[#34D399]">
              Resume Generation →
            </Link>
          </div>
        ) : activeId ? (
          <>
            <div className="terminal-card mt-6 p-5">
              <p className="font-mono text-sm text-[#34D399]">&gt; {title || "path in progress"} — continue where you left off</p>
              <div className="mt-2 flex flex-wrap gap-2 font-mono text-xs text-[#8BA494]">
                <span>streak {streak}d</span><span>·</span><span>XP {xp}</span><span>·</span><span>quiz avg {quizAvg}</span>
              </div>
              {firstOpen && (
                <Link
                  href={firstOpen.type === "project" ? `/app/projects/${activeId}/${firstOpen.order}` : `/app/lesson/${activeId}/${firstOpen.order}`}
                  className="mt-4 inline-block rounded-lg bg-[#10B981] px-5 py-2.5 text-sm font-semibold text-[#050A08] hover:bg-[#34D399]"
                >
                  Resume: {firstOpen.title.slice(0, 40)} →
                </Link>
              )}
              <Link href={`/app/roadmap/${activeId}`} className="ml-3 mt-4 inline-block rounded-lg border border-[#10B98133] px-5 py-2.5 text-sm">
                Full Path
              </Link>
            </div>

            <h2 className="font-display mt-8 text-lg font-bold">Up next</h2>
            <div className="mt-3 space-y-2">
              {open.map((n) => (
                <Link
                  key={n.order}
                  href={n.type === "project" ? `/app/projects/${activeId}/${n.order}` : `/app/lesson/${activeId}/${n.order}`}
                  className="terminal-card flex items-center gap-3 p-4 hover:border-[#10B981]"
                >
                  <span className="font-mono text-xs text-[#34D399]">{String(n.order).padStart(2, "0")}</span>
                  <span className="flex-1 text-sm font-semibold">{n.title}</span>
                  {n.weak && <span className="rounded-full bg-[#FBBF2422] px-2 py-0.5 font-mono text-[11px] text-[#FBBF24]">weak</span>}
                  <span className="font-mono text-[11px] text-[#8BA494]">{n.type}</span>
                </Link>
              ))}
              {open.length === 0 && <p className="text-sm text-[#34D399]">Path complete — regenerate from Settings or polish projects. 🎉</p>}
            </div>

            {weak.length > 0 && (
              <>
                <h2 className="font-display mt-8 text-lg font-bold">Needs review</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {weak.map((n) => (
                    <Link key={n.order} href={`/app/tutor?roadmapId=${activeId}&order=${n.order}`} className="rounded-full border border-[#FBBF2455] px-3 py-1.5 text-xs text-[#FBBF24] hover:bg-[#FBBF2411]">
                      weak · {n.title.slice(0, 30)} → tutor
                    </Link>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-[#8BA494]">No active roadmap yet. Generate one from onboarding — it takes about a minute.</p>
            <div className="terminal-card mt-6 p-5">
              <p className="font-mono text-sm text-[#34D399]">&gt; no active roadmap yet</p>
              <Link href="/onboarding" className="mt-4 inline-block rounded-lg bg-[#10B981] px-5 py-2.5 text-sm font-semibold text-[#050A08] hover:bg-[#34D399]">
                Go to Onboarding
              </Link>
            </div>
          </>
        )}
      </main>
      {/* mobile bottom tabs (plan §7) */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-[#10B98122] bg-[#050A08]/95 px-2 py-2 backdrop-blur md:hidden">
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
