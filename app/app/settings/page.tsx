"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { InstallButton } from "@/components/InstallButton";
type Log={task:string;provider:string;latency_ms:number;fallback_used:boolean;error_code:string|null;ts:string};
export default function Settings(){
  const router=useRouter();
  const [logs,setLogs]=useState<Log[]|null>(null);
  const [msg,setMsg]=useState("");
  const clerkKey=process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const [pace,setPace]=useState(1.5);
  const [gate,setGate]=useState(70);
  const [remedial,setRemedial]=useState(true);
  const [strict,setStrict]=useState(true);
  const [fallback,setFallback]=useState(true);
  useEffect(()=>{(async()=>{try{const j=await fetch("/api/me/diagnostics").then(r=>r.json());setLogs(j.logs??[]);}catch{setLogs([]);}})()},[]);
  async function regen(){setMsg("");const r=await fetch("/api/me/regenerate",{method:"POST"});if(r.ok)router.push("/onboarding");else setMsg("Regenerate failed. Retry.");}
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
          <div><p className="px-2 font-mono text-[10px] tracking-widest text-[#8BA494]">ACCOUNT</p><div className="mt-1 space-y-0.5"><Link href="/app/profile" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">◯ Profile</Link><p className="flex items-center gap-2 rounded bg-[#10B98114] px-2 py-1.5 text-[#E6F4ED]">⚙ Settings</p></div></div>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#10B98112] bg-[#050A08]/90 px-3 py-2 backdrop-blur">
          <p className="font-mono text-xs text-[#8BA494]">hipath &gt; workspace / settings // preferences <span className="rounded bg-[#10B98122] px-1 py-0.5 text-[#10B981]">CONFIG_STABLE</span></p>
          <span className="ml-auto hidden items-center gap-2 md:flex"><span className="rounded border border-[#10B98122] bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#10B981]">● Heuristics Engine v2.4.9</span></span>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-4 p-3 md:p-4">
          <div>
            <h1 className="font-display text-xl font-bold">Application Settings & AI Engine Calibration</h1>
            <p className="font-mono text-xs text-[#8BA494]">Configure your learning heuristics, Socratic tutor inference parameters, and low-level account telemetry.</p>
          </div>
          <div className="terminal-card p-4">
            <p className="font-mono text-[10px] tracking-widest text-[#10B981]">STEP // 01 Learning Pace</p>
            <h2 className="font-display text-sm font-bold">Learning Heuristics & Adaptive Engine <span className="font-mono text-[10px] text-[#8BA494]">SRS_CALIBRATION</span></h2>
            <div className="mt-3">
              <p className="flex justify-between font-mono text-xs"><span>Daily Study Target</span><span className="text-[#10B981]">{pace} hrs / day ({pace*60}min)</span></p>
              <input type="range" min={0.5} max={4} step={0.5} value={pace} onChange={(e)=>setPace(Number(e.target.value))} className="mt-2 w-full accent-[#10B981]" />
              <div className="flex justify-between font-mono text-[10px] text-[#8BA494]"><span>30m (Sprint)</span><span className="text-[#10B981]">90m (Recommended)</span><span>240m (Bootcamp)</span></div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-[#0A120E] p-3">
                <p className="font-mono text-xs font-bold">Spaced Repetition Sensitivity</p>
                <div className="mt-2 space-y-2">
                  <label className="flex items-center gap-2 rounded border border-[#10B981] bg-[#10B98122] px-3 py-2 font-mono text-xs"><input type="radio" name="srs" defaultChecked className="accent-[#10B981]" /> Aggressive Mode Active</label>
                  <label className="flex items-center gap-2 rounded border border-[#10B98114] bg-[#060D0A] px-3 py-2 font-mono text-xs text-[#8BA494]"><input type="radio" name="srs" className="accent-[#10B981]" /> Balanced (48h Cadence)</label>
                </div>
              </div>
              <div className="rounded-lg bg-[#0A120E] p-3">
                <p className="font-mono text-xs font-bold">Quiz Gate Strictness</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[70,80,90].map((v)=><button key={v} onClick={()=>setGate(v)} className={`rounded-lg border px-3 py-2 font-mono text-xs ${gate===v?"border-[#10B981] bg-[#10B98122] text-[#10B981]":"border-[#10B98114] bg-[#060D0A] text-[#8BA494]"}`}><p className="font-bold">{v}%</p><p className="text-[10px]">{v===70?"Standard":v===80?"Rigorous":"Mastery"}</p></button>)}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-[#0A120E] p-3">
              <div><p className="font-mono text-xs font-bold">Remedial Auto-Injection</p><p className="font-mono text-[11px] text-[#8BA494]">Automatically insert remedial breakdown exercises into next tree when 2+ consecutive quiz fails.</p></div>
              <button onClick={()=>setRemedial(!remedial)} className={`h-5 w-9 rounded-full p-0.5 ${remedial?"bg-[#10B981]":"bg-[#8BA49433]"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${remedial?"translate-x-4":"translate-x-0"}`} /></button>
            </div>
          </div>
          <div className="terminal-card p-4">
            <p className="font-mono text-[10px] tracking-widest text-[#10B981]">STEP // 02 AI Tutor & Socratic Engine Calibration</p>
            <h2 className="font-display text-sm font-bold">AI Tutor & Socratic Engine Calibration</h2>
            <div className="mt-3 rounded-lg bg-[#0A120E] p-3">
              <p className="font-mono text-xs font-bold">Socratic Guidance Mode</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <label className={`rounded-lg border p-3 ${strict?"border-[#10B981] bg-[#10B98122]":"border-[#10B98114] bg-[#060D0A]"}`}><div className="flex items-center gap-2 font-mono text-xs font-bold"><input type="radio" checked={strict} onChange={()=>setStrict(true)} className="accent-[#10B981]" /> Strict Socratic (Recommended) <span className="rounded bg-[#10B981] px-1 py-0.5 text-[10px] text-[#050A08]">ACTIVE</span></div><p className="font-mono text-[11px] text-[#8BA494]">The model poses guided diagnostic questions, never logic, never outputs complete solutions.</p></label>
                <label className={`rounded-lg border p-3 ${!strict?"border-[#10B981] bg-[#10B98122]":"border-[#10B98114] bg-[#060D0A]"}`}><div className="flex items-center gap-2 font-mono text-xs font-bold"><input type="radio" checked={!strict} onChange={()=>setStrict(false)} className="accent-[#10B981]" /> Exploratory / Direct Code</div><p className="font-mono text-[11px] text-[#8BA494]">AI acts as pair-programmer, providing direct snippets, refactors, and comparative code outputs on request.</p></label>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-[#0A120E] p-3"><p className="font-mono text-xs font-bold">Code Explanation Depth</p><p className="font-mono text-[11px] text-[#8BA494]">Target abstraction level when analyzing syntax, data structures, and errors.</p><div className="mt-2 rounded bg-[#10B98122] px-3 py-2 font-mono text-xs text-[#10B981]">Systems & CPython Internals — Selected</div></div>
              <div className="rounded-lg bg-[#0A120E] p-3"><p className="font-mono text-xs font-bold">Fast Fallback Routing</p><p className="font-mono text-[11px] text-[#8BA494]">Automatic sub-model failover strategy during peak inference latency.</p><div className="mt-2 flex items-center justify-between rounded bg-[#060D0A] px-3 py-2"><span className="font-mono text-xs">18ms Latency Mode</span><button onClick={()=>setFallback(!fallback)} className={`h-5 w-9 rounded-full p-0.5 ${fallback?"bg-[#10B981]":"bg-[#8BA49433]"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${fallback?"translate-x-4":""}`} /></button></div></div>
            </div>
          </div>
          <div className="terminal-card p-4">
            <p className="font-mono text-[10px] tracking-widest text-[#10B981]">STEP // 03 Notifications & Webhook Telemetry</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-[#0A120E] p-3"><div><p className="font-mono text-xs font-bold">Daily Learning Scheduled Ping</p><p className="font-mono text-[11px] text-[#8BA494]">Push desktop & terminal prompt to commence daily retention block.</p></div><span className="font-mono text-xs text-[#8BA494]">08:00 AM UTC</span></div>
              <div className="flex items-center justify-between rounded-lg bg-[#0A120E] p-3"><div><p className="font-mono text-xs font-bold">Roadmap AI Adaptation Alerts</p><p className="font-mono text-[11px] text-[#8BA494]">Notify whenever the engine restructures successor phases based on code review bottlenecks.</p></div><span className="h-5 w-9 rounded-full bg-[#10B981] p-0.5"><span className="block h-4 w-4 translate-x-4 rounded-full bg-white" /></span></div>
              <div className="flex items-center justify-between rounded-lg bg-[#0A120E] p-3"><div><p className="font-mono text-xs font-bold">GitHub PR Rubric Grading Alerts</p><p className="font-mono text-[11px] text-[#8BA494]">Instant dispatch when project automated test suite and AI code analysis completes.</p></div><span className="h-5 w-9 rounded-full bg-[#10B981] p-0.5"><span className="block h-4 w-4 translate-x-4 rounded-full bg-white" /></span></div>
            </div>
          </div>
          <div className="terminal-card p-4">
            <p className="font-mono text-[10px] tracking-widest text-[#10B981]">STEP // 04 General Profile & Developer Identity</p>
            <div className="flex gap-3">
              <div className="h-12 w-12 rounded-full bg-[#0A120E]"></div>
              <div><p className="font-display text-sm font-bold">Hirdendra</p><p className="font-mono text-xs text-[#8BA494]">Tier 1 - Pro</p></div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-[#0A120E] p-3"><p className="font-mono text-[10px] tracking-widest text-[#8BA494]">PREFERRED SHELL</p><p className="font-mono text-xs">zsh / posix-extended</p></div>
              <div className="rounded-lg bg-[#0A120E] p-3"><p className="font-mono text-[10px] tracking-widest text-[#8BA494]">TIMEZONE ANCHOR</p><p className="font-mono text-xs">UTC+05:30 (Asia/Kolkata)</p></div>
            </div>
          </div>
          <div className="terminal-card border-[#F8717155] p-4">
            <p className="font-mono text-[10px] tracking-widest text-[#F87171]">STEP // 05 Danger Zone — IRREVERSIBLE</p>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-[#0A120E] p-3"><div><p className="font-mono text-xs font-bold">Reset Roadmap Progress</p><p className="font-mono text-[11px] text-[#8BA494]">Wipes module completion stats, SRS mastery curves, and quiz locks. Leaves custom notes intact.</p></div><button onClick={()=>void regen()} className="rounded bg-[#FBBF2422] px-3 py-1.5 font-mono text-xs text-[#FBBF24]">Reset Progress</button></div>
              <div className="flex items-center justify-between rounded-lg bg-[#0A120E] p-3"><div><p className="font-mono text-xs font-bold">Export Telemetry & Session Archive</p><p className="font-mono text-[11px] text-[#8BA494]">Download all your code submissions, tutor prompt dialogs, and spaced-repetition latency metrics in JSON format.</p></div><a href="/api/me" download="hipath-export.json" className="rounded bg-[#0A120E] px-3 py-1.5 font-mono text-xs text-[#10B981]">&darr; Export (.json)</a></div>
              <div className="flex items-center justify-between rounded-lg bg-[#F8717111] p-3"><div><p className="font-mono text-xs font-bold text-[#F87171]">Delete Account & Wipe Persistent Storage</p><p className="font-mono text-[11px] text-[#8BA494]">Irrevocably deletes profile data, synced Git tokens, learning history, and cached embeddings from vector cluster.</p></div><button onClick={async()=>{await fetch("/api/me",{method:"DELETE"});window.location.href="/"}} className="rounded bg-[#F87171] px-3 py-1.5 font-mono text-xs font-bold text-white">Delete Account</button></div>
            </div>
            {msg&&<p className="mt-2 font-mono text-xs text-[#F87171]">{msg}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button className="rounded-lg border border-[#10B98114] bg-[#0A120E] px-4 py-2 font-mono text-xs">Discard</button>
            <button className="rounded-lg bg-[#10B981] px-4 py-2 font-mono text-xs font-bold text-[#050A08]">✓ Save Changes</button>
          </div>
          <div className="terminal-card p-3">
            <p className="font-mono text-[10px] tracking-widest text-[#10B981]">DIAGNOSTICS · ai_logs</p>
            {!logs&&<p className="font-mono text-xs text-[#8BA494]">loading…</p>}
            {logs&&logs.length===0&&<p className="font-mono text-xs text-[#8BA494]">No AI calls yet.</p>}
            {logs&&logs.length>0&&<div className="divide-y divide-[#10B9810F] font-mono text-xs">{logs.map((l,i)=><div key={i} className="flex items-center justify-between gap-2 py-1.5"><span className="text-[#C9DCD2]">{l.task} · {l.provider} · {l.latency_ms}ms</span><span className={l.fallback_used?"text-[#FBBF24]":"text-[#10B981]"}>{l.fallback_used?"fallback":"primary"}</span></div>)}</div>}
          </div>
          <div className="flex justify-end gap-2">
            <Link href="/app/dashboard" className="rounded-lg border border-[#10B98114] bg-[#0A120E] px-4 py-2 font-mono text-xs">Back to Dashboard</Link>
            {clerkKey?<SignOutButton />:<Link href="/" className="rounded-lg border border-[#10B98114] px-4 py-2 font-mono text-xs">Back home</Link>}
          </div>
        </main>
      </div>
    </div>
  );
}
function SignOutButton(){
  const router=useRouter();
  const {signOut}=useClerk();
  return (<button onClick={()=>void signOut(()=>router.push("/"))} className="rounded-lg border border-[#10B98114] bg-[#0A120E] px-4 py-2 font-mono text-xs">Sign out</button>);
}
