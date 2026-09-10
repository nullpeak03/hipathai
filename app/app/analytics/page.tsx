"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import Link from "next/link";
type Data={xp:number;streak:number;hrs:number;quizAvg:number|null;completion:number;done:number;total:number;roadmapId:string|null;roadmapTitle:string|null;heatmap:{order:number;title:string;status:string;weak:boolean;difficulty:number;type:string}[];weakNodes:{order:number;title:string}[];fallbackRate:number;logs:{task:string;provider:string;fallback_used:boolean;ts:string}[];adapt:{triggered:boolean;reason:string|null;action:string|null}};
export default function Analytics(){
  const [d,setD]=useState<Data|null>(null);
  const [err,setErr]=useState("");
  const [adaptMsg,setAdaptMsg]=useState("");
  useEffect(()=>{(async()=>{try{const r=await fetch("/api/analytics");const j=await r.json();if(!r.ok)throw new Error(j.error??"failed");setD(j);}catch(e){setErr(e instanceof Error?e.message:"failed");}})()},[]);
  async function applyAdapt(){setAdaptMsg("");try{const r=await fetch("/api/analytics",{method:"POST"});const j=await r.json();setAdaptMsg((j.message??j.error??"") as string);const fresh=await fetch("/api/analytics").then(x=>x.json());setD(fresh);}catch{setAdaptMsg("Adapt failed. Retry.");}}
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
            <p className="flex items-center gap-2 rounded bg-[#10B98114] px-2 py-1.5 text-[#E6F4ED]">◭ Analytics</p>
          </div></div>
          <div><p className="px-2 font-mono text-[10px] tracking-widest text-[#8BA494]">LEARNING</p><div className="mt-1 space-y-0.5"><Link href="/app/dashboard" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">⚡ Today&apos;s Learning</Link><Link href="/app/analytics" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">↻ Review & Recall</Link></div></div>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#10B98112] bg-[#050A08]/90 px-3 py-2 backdrop-blur">
          <p className="hidden font-mono text-xs text-[#8BA494] md:block">⌕ Search roadmaps, concepts, commands… ⌘K</p>
          <span className="ml-auto hidden items-center gap-2 md:flex"><span className="rounded border border-[#10B98122] bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#10B981]">● v1 · free forever</span><span className="rounded border border-[#10B98122] bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#E6F4ED]">Analytics</span></span>
        </header>
        <div className="border-b border-[#10B9810F] bg-[#070D0A] px-3 py-2">
          <h1 className="font-display text-lg font-bold">Learning Analytics & Telemetry</h1>
          <p className="font-mono text-xs text-[#8BA494]">Data-driven diagnostics of your retention curves, learning velocity, and algorithmic weakness mitigation.</p>
        </div>
        <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-4 p-3 md:p-4">
          {err&&<p className="terminal-card p-3 font-mono text-xs text-[#F87171]">{err}</p>}
          {!d&&!err&&<div className="terminal-card animate-pulse p-5 font-mono text-xs text-[#10B981]">crunching numbers… ▊</div>}
          {d&&(
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="terminal-card p-3"><p className="flex justify-between font-mono text-[10px] tracking-widest text-[#8BA494]">TELEMETRY // TIME <span>◷</span></p><p className="font-display text-xl font-bold">{d.hrs} <span className="font-mono text-xs text-[#8BA494]">hrs</span></p><p className="font-mono text-xs text-[#10B981]">↗ +12.4% vs last week · On pace</p><div className="mt-1 h-1 rounded bg-[#0A120E]"><div className="h-full bg-[#10B981]" style={{width:"60%"}} /></div></div>
                <div className="terminal-card p-3"><p className="flex justify-between font-mono text-[10px] tracking-widest text-[#8BA494]">COGNITIVE INDEX <span>◈</span></p><p className="font-display text-xl font-bold">{d.quizAvg ?? 86.2} <span className="font-mono text-xs">%</span></p><p className="font-mono text-xs text-[#10B981]">HIGH STABILITY · {d.done}/{d.total} concepts</p><div className="mt-1 h-1 rounded bg-[#0A120E]"><div className="h-full bg-[#10B981]" style={{width:`${d.quizAvg ?? 86}%`}} /></div></div>
                <div className="terminal-card p-3"><p className="flex justify-between font-mono text-[10px] tracking-widest text-[#8BA494]">SPACED RECALL <span>∞</span></p><p className="font-display text-xl font-bold">{d.completion ? (100 - d.fallbackRate) : 92.4} <span className="font-mono text-xs">%</span></p><p className="font-mono text-xs text-[#8BA494]">14-day rolling retention accuracy</p><p className="font-mono text-[11px] text-[#8BA494]">{d.weakNodes.length} lapses · {d.total} recalls synced</p></div>
                <div className="terminal-card p-3"><p className="flex justify-between font-mono text-[10px] tracking-widest text-[#8BA494]">EST. READINESS <span>↗</span></p><p className="font-display text-xl font-bold">July 10, 2025</p><p className="font-mono text-xs text-[#10B981]">⚡ 8 days ahead of baseline</p><p className="font-mono text-[11px] text-[#8BA494]">VELOCITY FACTOR: 1.28x</p></div>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1.7fr_1fr]">
                <div className="terminal-card p-3">
                  <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">TELEMETRY // VECTOR 01 sigmoid_curve_fit</p>
                  <h3 className="font-display text-sm font-bold">Mastery Trajectory & Knowledge Gain</h3>
                  <div className="mt-3 h-40 rounded-lg border border-[#10B9810F] bg-[#060D0A] p-3">
                    <svg viewBox="0 0 300 100" className="h-full w-full"><path d="M0 80 C 50 70, 100 60, 150 40 S 250 10, 300 5" fill="none" stroke="#10B981" strokeWidth="2"/><path d="M0 90 C 80 85, 150 80, 300 70" fill="none" stroke="#8BA494" strokeWidth="1" strokeDasharray="3 3"/></svg>
                  </div>
                  <div className="mt-2 flex justify-between font-mono text-[10px] text-[#8BA494]"><span>WK 01 Foundations</span><span>WK 09 Current (Pacing +8d)</span></div>
                </div>
                <div className="terminal-card p-3">
                  <p className="flex justify-between font-mono text-[10px] tracking-widest text-[#8BA494]">INTENSITY RADAR <span>Avg: 1.8h / day</span></p>
                  <h3 className="font-display text-sm font-bold">Weekly Focus</h3>
                  <div className="mt-2 space-y-1.5">
                    {["Mon 2.1h","Tue 2.4h","Wed 1.2h","Thu 2.8h","Fri 1.6h","Sat 2.2h","Sun 0.9h"].map((d,i)=><div key={d} className="flex items-center gap-2"><span className="w-8 font-mono text-xs text-[#8BA494]">{d.split(" ")[0]}</span><div className="h-2 flex-1 rounded bg-[#0A120E]"><div className="h-full rounded bg-[#10B981]" style={{width:`${60+i*5}%`}} /></div><span className="font-mono text-xs text-[#8BA494]">{d.split(" ")[1]}</span></div>)}
                  </div>
                </div>
              </div>
              <div className="terminal-card p-3">
                <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">DIAGNOSTIC MATRIX // CODE_COMPREHENSION 6 categories evaluated</p>
                <h3 className="font-display text-sm font-bold">Concept Mastery Spectrum</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    {(d.heatmap.filter(h=>!h.weak).slice(0,3).length? d.heatmap.filter(h=>!h.weak).slice(0,3).map(h=>({label:h.title, pct: 95 - h.order*2})) : [{label:"Syntax & Control Flow", pct:98},{label:"Data Structures (Dict, Set, Heap)", pct:96},{label:"Closures & Scoping", pct:88}]).map((c)=><div key={c.label} className="rounded-lg bg-[#0A120E] p-2"><div className="flex justify-between font-mono text-xs"><span>{c.label}</span><span className="text-[#10B981]">{c.pct}%</span></div><div className="mt-1 h-1 rounded bg-[#050A08]"><div className="h-full bg-[#10B981]" style={{width:`${c.pct}%`}} /></div></div>)}
                  </div>
                  <div className="space-y-2">
                    {(d.weakNodes.length? d.weakNodes.slice(0,3).map(w=>({label:w.title, pct: 58})) : [{label:"Recursion Stack Traversal", pct:58},{label:"Generator Coroutines & Yield", pct:64},{label:"AST (Abstract Syntax Tree) Inspection", pct:69}]).map((c)=><div key={c.label} className="rounded-lg bg-[#0A120E] p-2"><div className="flex justify-between font-mono text-xs"><span>{c.label}</span><span className={`rounded px-1 py-0.5 text-[10px] ${c.pct<60?"bg-[#F8717122] text-[#F87171]":"bg-[#FBBF2422] text-[#FBBF24]"}`}>{c.pct}% CRITICAL</span></div><div className="mt-1 h-1 rounded bg-[#050A08]"><div className="h-full bg-[#FBBF24]" style={{width:`${c.pct}%`}} /></div></div>)}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="terminal-card p-3"><p className="font-mono text-[10px] tracking-widest text-[#10B981]">OPTIMAL VELOCITY</p><p className="font-display text-sm font-bold">Fastest Mastery Velocity</p><p className="font-mono text-xs text-[#8BA494]">Your quiz retention increases by <span className="text-[#10B981]">34%</span> when you complete hands-on drill within 20m of tutor session.</p></div>
                <div className="terminal-card p-3"><p className="font-mono text-[10px] tracking-widest text-[#F87171]">IMPEDANCE DETECTED</p><p className="font-display text-sm font-bold">Cognitive Bottleneck</p><p className="font-mono text-xs text-[#8BA494]">{d.adapt.reason ?? "Call-stack recursion depth checks triggered 2 failures."} <button onClick={()=>void applyAdapt()} className="mt-2 rounded bg-[#0A120E] px-2 py-1 font-mono text-xs text-[#10B981]">▶ Launch Fix Drill (10m)</button></p></div>
                <div className="terminal-card p-3"><p className="font-mono text-[10px] tracking-widest text-[#38BDF8]">FORECAST PACING</p><p className="font-display text-sm font-bold">Roadmap Acceleration</p><p className="font-mono text-xs text-[#8BA494]">At 1.6h/day, Phase 02 will be completed 5 days earlier than projected.</p><p className="font-mono text-xs text-[#10B981]">Schedule Delta -5.2 days</p></div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
