"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import Link from "next/link";
import { InstallButton } from "@/components/InstallButton";
export default function Profile(){
  const [data,setData]=useState<{user:Record<string,unknown>|null;roadmap:{title:string;goal:string;version:number}|null}|null>(null);
  const [goal,setGoal]=useState(""); const [hrs,setHrs]=useState(2); const [msg,setMsg]=useState(""); const [confirmDel,setConfirmDel]=useState(false);
  useEffect(()=>{(async()=>{try{const j=await fetch("/api/me/profile").then(r=>r.json());setData(j);setGoal((j.roadmap?.goal??"") as string);setHrs(Number((j.user as {hrs_per_day?:number}|null)?.hrs_per_day??2));}catch{}})()},[]);
  async function save(){setMsg("");const r=await fetch("/api/me/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({goal:goal||undefined,hrsPerDay:hrs})});setMsg(r.ok?"Saved ✓":"Save failed. Retry.");}
  async function wipe(){if(!confirmDel){setConfirmDel(true);return;}await fetch("/api/me",{method:"DELETE"});window.location.href="/";}
  const user=(data?.user??{}) as {xp?:number;streak?:number;level?:string;track?:string};
  return (
    <div className="flex min-h-screen bg-[#050A08] text-[#E6F4ED]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#10B98112] bg-[#050A08] p-3 md:flex">
        <div className="rounded-lg border border-[#10B98114] bg-[#0A120E] px-3 py-2">
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#8BA494]"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></span> workspace <span className="text-[#10B981]">&gt;</span></div>
          <div className="font-mono text-xs text-[#10B981]">/ learn_to_ship()</div>
        </div>
        <nav className="mt-4 space-y-4 text-[13px]">
          <div><p className="px-2 font-mono text-[10px] tracking-widest text-[#8BA494]">MAIN</p><div className="mt-1 space-y-0.5">
            <Link href="/app/dashboard" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:bg-[#0A120E] hover:text-[#E6F4ED]">▦ Dashboard</Link>
            <Link href="/app/dashboard" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">↗ Roadmap</Link>
            <Link href="/app/tutor" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">◈ AI Tutor</Link>
            <Link href="/app/dashboard" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">▭ Practice</Link>
            <Link href="/app/dashboard" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">◇ Projects</Link>
            <Link href="/app/analytics" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">◭ Analytics</Link>
          </div></div>
          <div><p className="px-2 font-mono text-[10px] tracking-widest text-[#8BA494]">ACCOUNT</p><div className="mt-1 space-y-0.5"><p className="flex items-center gap-2 rounded bg-[#10B98114] px-2 py-1.5 text-[#E6F4ED]">◯ Profile</p><Link href="/app/settings" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">⚙ Settings</Link></div></div>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#10B98112] bg-[#050A08]/90 px-3 py-2 backdrop-blur">
          <p className="font-mono text-xs text-[#8BA494]">workspace / profile // learner_identity.proto <span className="rounded bg-[#10B98122] px-1 py-0.5 text-[#10B981]">READ-WRITE</span></p>
          <span className="ml-auto hidden items-center gap-2 md:flex"><span className="rounded border border-[#10B98122] bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#10B981]">● sync: synced with remote</span></span>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-4 p-3 md:p-4">
          <div className="terminal-card p-4">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="h-24 w-24 shrink-0 rounded-lg bg-[#0A120E]"></div>
              <div className="flex-1">
                <h1 className="font-display text-xl font-bold">Hirdendra Patel <span className="font-mono text-xs text-[#8BA494]">@hirdendra</span></h1>
                <p className="font-mono text-xs text-[#8BA494]">Aspiring Production AI Engineer transitioning from full-stack software development. Focusing on high-throughput LLM pipelines, autonomous agents, and systems engineering.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded bg-[#10B98122] px-2 py-1 font-mono text-xs text-[#10B981]">● PRO</span>
                  <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-xs text-[#8BA494]">Phase 01 Builder</span>
                  <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-xs text-[#FBBF24]">14-Day Streak 🔥</span>
                  <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-xs text-[#38BDF8]">◈ Top 5% Pacer</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <button onClick={()=>void save()} className="rounded bg-[#10B981] px-4 py-2 font-mono text-xs font-bold text-[#050A08]">✓ Edit Profile</button>
                <a href="/api/me" download="hipath-export.json" className="rounded border border-[#10B98114] bg-[#0A120E] px-4 py-2 text-center font-mono text-xs">↗ Share Public Portfolio</a>
                <button className="rounded border border-[#10B98114] bg-[#0A120E] px-4 py-2 font-mono text-xs text-[#8BA494]">⎙ Copy Verified Badge URL</button>
              </div>
            </div>
            <p className="mt-3 flex flex-wrap gap-2 font-mono text-[11px] text-[#8BA494]"><span>ENCRYPTED IDENTITY: HIPATH_EID_88291</span><span className="text-[#10B981]">PUBLIC NODE: hipath.ai/@hirdendra</span><span className="ml-auto text-[#10B981]">● Public verifiable portfolio live</span></p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1.7fr_1fr]">
            <div className="terminal-card p-4">
              <p className="flex justify-between font-mono text-[10px] tracking-widest text-[#8BA494]"><span>&gt; ACTIVE TARGET GOAL // CURRICULUM SPEC</span><span className="rounded bg-[#10B98122] px-1 py-0.5 text-[#10B981]">CYCLE 01 ACTIVE</span></p>
              <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">PRIMARY OBJECTIVE</p>
              <h2 className="font-display text-lg font-bold">Become a Production AI Engineer <span className="font-mono text-xs font-normal text-[#8BA494]">Target: July 2025</span></h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-[#0A120E] p-3"><p className="font-mono text-[10px] tracking-widest text-[#8BA494]">SPECIALIZATION TRACK</p><p className="font-mono text-xs font-bold text-[#10B981]">AI Engineering & Autonomous Systems</p><p className="font-mono text-[11px] text-[#8BA494]">v2.4 Production Standard</p></div>
                <div className="rounded-lg bg-[#0A120E] p-3"><p className="font-mono text-[10px] tracking-widest text-[#8BA494]">TARGET DAILY PACE</p><p className="font-mono text-xs font-bold">1.5 - 2.0 hrs/day</p><p className="font-mono text-[11px] text-[#38BDF8]">Accelerated Cohort Track</p></div>
              </div>
              <div className="mt-3 rounded-lg bg-[#060D0A] p-3">
                <div className="flex justify-between font-mono text-xs"><span className="text-[#8BA494]">Current Learning Node:</span><span className="text-[#E6F4ED]">01.3 Functions, Closures & Higher-Order Decorators</span><span className="text-[#10B981]">68% Complete</span></div>
                <div className="mt-1 h-1.5 rounded bg-[#0A120E]"><div className="h-full bg-[#10B981]" style={{width:"68%"}} /></div>
              </div>
              <div className="mt-3 terminal-card p-3">
                <p className="font-mono text-xs font-bold">Goal + Hours (real)</p>
                <input value={goal} onChange={(e)=>setGoal(e.target.value)} placeholder="Goal" className="mt-2 w-full rounded-lg border border-[#10B98133] bg-[#060D0A] px-3 py-2 font-mono text-xs outline-none focus:border-[#10B981]" />
                <label className="mt-2 block font-mono text-xs text-[#8BA494]">Hours / day: <span className="text-[#E6F4ED]">{hrs}h</span><input type="range" min={1} max={8} value={hrs} onChange={(e)=>setHrs(Number(e.target.value))} className="mt-1 w-full accent-[#10B981]" /></label>
                <button onClick={()=>void save()} className="mt-2 rounded bg-[#10B981] px-3 py-1.5 font-mono text-xs font-bold text-[#050A08]">Save</button>{msg&&<span className="ml-2 font-mono text-xs text-[#10B981]">{msg}</span>}
                <p className="mt-2 font-mono text-xs text-[#8BA494]">XP {user.xp??0} · streak {user.streak??0}d · {user.track??"—"} · {user.level??"—"}</p>
              </div>
            </div>
            <div className="terminal-card p-4 text-center">
              <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">PACE & VELOCITY RADAR <span className="text-[#10B981]">ON SCHEDULE</span></p>
              <p className="font-mono text-xs">Efficiency Metric: <span className="text-[#10B981]">1.34x</span></p>
              <div className="mx-auto mt-3 flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#10B981]"><p className="font-display text-xl font-bold">74%<br/><span className="font-mono text-[10px] text-[#8BA494]">ROADMAP PACED</span></p></div>
              <div className="mt-3 space-y-1 font-mono text-xs text-[#8BA494]"><p>Weekly Target: 14 / 14 hrs (100%)</p><p>Active Streak: 14 Consecutive Days</p><p>Review Retention: 91.4% Spaced Recall</p></div>
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">CRYPTOGRAPHIC PROOF-OF-WORK // CREDENTIALS</p>
            <h2 className="font-display text-lg font-bold">Verified Competencies & Artifacts</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              {[
                ["Python Core & Memory Internals","98% Mastery · 44 Katas","0x8a92…e1f","VERIFIED"],
                ["Data Structures & Algorithms","95% Mastery · 32 Challenges","0x3b41…98c","VERIFIED"],
                ["Functional Decorators & Metaprogramming","74% Proficient · Assessment Active","3/4","IN PROGRESS"],
                ["Git & CI/CD Production Pipelines","Peer and Automated PR Review Approved","hirdendra/ops#14","GITHUB PR"],
              ].map(([t,sub,hash,status])=>(
                <div key={t as string} className="terminal-card p-3">
                  <p className="flex justify-between font-mono text-[10px]"><span className={`rounded px-1 py-0.5 ${status==="VERIFIED"?"bg-[#10B98122] text-[#10B981]":"bg-[#38BDF822] text-[#38BDF8]"}`}>● {status as string}</span></p>
                  <p className="font-display mt-2 text-sm font-bold">{t as string}</p>
                  <p className="font-mono text-xs text-[#8BA494]">{sub as string}</p>
                  <p className="mt-2 font-mono text-[11px] text-[#10B981]">Proof Hash: {hash as string}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="terminal-card p-4">
            <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">LIFETIME TELEMETRY & HEATMAP ENGINE</p>
            <h2 className="font-display text-lg font-bold">Contribution & Knowledge Velocity</h2>
            <div className="mt-2 grid grid-cols-4 gap-2 font-mono text-xs">
              <div className="rounded bg-[#0A120E] p-2 text-center"><p className="text-[#8BA494]">STUDY LOGGED</p><p className="font-bold text-[#E6F4ED]">48.5h</p></div>
              <div className="rounded bg-[#0A120E] p-2 text-center"><p className="text-[#8BA494]">NODES DONE</p><p className="font-bold text-[#10B981]">34/82</p></div>
              <div className="rounded bg-[#0A120E] p-2 text-center"><p className="text-[#8BA494]">KATAS SHIPPED</p><p className="font-bold text-[#10B981]">42</p></div>
              <div className="rounded bg-[#0A120E] p-2 text-center"><p className="text-[#8BA494]">QUIZZES PASSED</p><p className="font-bold text-[#10B981]">28</p></div>
            </div>
            <div className="mt-3 h-24 rounded-lg border border-[#10B9810F] bg-[#060D0A] p-2 font-mono text-[10px] text-[#10B981]">382 system interactions in the last 365 days · Active Streak: 14 days</div>
            <div className="mt-3"><InstallButton /></div>
            <div className="mt-2 flex gap-2">
              <button onClick={()=>void wipe()} className={`flex-1 rounded-lg px-4 py-2 font-mono text-xs font-bold ${confirmDel?"bg-[#F87171] text-[#050A08]":"border border-[#F8717155] text-[#F87171]"}`}>{confirmDel?"Confirm delete everything":"Delete account"}</button>
              <a href="/api/me" download="hipath-export.json" className="flex-1 rounded-lg border border-[#10B98114] bg-[#0A120E] px-4 py-2 text-center font-mono text-xs">Export JSON</a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
