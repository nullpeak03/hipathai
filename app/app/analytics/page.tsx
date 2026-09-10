"use client";
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
        <Link href="/app/dashboard" className="rounded-lg border border-[#10B98114] bg-[#0A120E] px-3 py-2 font-mono text-xs text-[#8BA494]">← Dashboard</Link>
        <p className="mt-4 font-mono text-[10px] tracking-widest text-[#8BA494]">ANALYTICS</p>
        <p className="font-display text-sm font-bold">Telemetry</p>
        <div className="mt-auto rounded-lg border border-[#10B98114] bg-[#0A120E] p-2.5">
          <p className="font-mono text-[11px] text-[#10B981]">● Weekly Pace</p>
          <p className="font-mono text-[11px] text-[#8BA494]"> vs Peers</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[#10B98112] bg-[#050A08]/90 px-3 py-2 backdrop-blur">
          <p className="font-mono text-xs text-[#8BA494]">ANALYTICS // mastery_telemetry_v1</p>
          <Link href="/app/dashboard" className="font-mono text-xs text-[#8BA494] hover:text-[#E6F4ED]">← Dashboard</Link>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-3 md:p-4">
          <h1 className="font-display text-xl font-bold">Analytics</h1>
          {err&&<p className="terminal-card mt-3 p-3 font-mono text-xs text-[#F87171]">{err}</p>}
          {!d&&!err&&<div className="terminal-card mt-3 animate-pulse p-5 font-mono text-xs text-[#10B981]">crunching numbers… ▊</div>}
          {d&&(
            <>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                {[
                  ["streak", `${d.streak}d`],
                  ["xp", `${d.xp}`],
                  ["quiz avg", d.quizAvg===null?"—":`${d.quizAvg}%`],
                  ["done", `${d.completion}%`],
                ].map(([k,v])=>(
                  <div key={k} className="terminal-card p-4 text-center">
                    <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">{k}</p>
                    <p className="font-display text-2xl font-bold text-[#10B981]">{v}</p>
                    <p className="font-mono text-xs text-[#8BA494]">~{d.hrs}h</p>
                  </div>
                ))}
              </div>
              {d.adapt.triggered&&<div className="terminal-card mt-3 border-[#FBBF2455] p-3"><p className="font-mono text-xs text-[#FBBF24]">adapt: {d.adapt.reason}</p><p className="font-mono text-xs text-[#8BA494]">{d.adapt.action}</p><button onClick={()=>void applyAdapt()} className="mt-2 rounded-lg bg-[#10B981] px-4 py-2 font-mono text-xs font-bold text-[#050A08]">Apply Adapt</button>{adaptMsg&&<p className="mt-2 font-mono text-xs text-[#10B981]">{adaptMsg}</p>}</div>}
              <div className="mt-4 grid gap-3 md:grid-cols-[1.7fr_1fr]">
                <div className="terminal-card p-3">
                  <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">SKILL HEATMAP</p>
                  <div className="mt-2 space-y-1.5">
                    {d.heatmap.map((n)=><div key={n.order} className="flex items-center gap-3 rounded-lg border border-[#10B9810F] bg-[#0A120E] px-3 py-2"><span className="font-mono text-xs text-[#10B981]">{String(n.order).padStart(2,"0")}</span><span className="flex-1 truncate font-mono text-xs">{n.title}</span>{n.weak&&<span className="rounded-full bg-[#FBBF2422] px-2 py-0.5 font-mono text-[10px] text-[#FBBF24]">weak</span>}<span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${n.status==="done"?"bg-[#10B98122] text-[#10B981]":"bg-[#8BA49414] text-[#8BA494]"}`}>{n.status} · Lv{n.difficulty}</span></div>)}
                    {d.heatmap.length===0&&<p className="font-mono text-xs text-[#8BA494]">No roadmap yet.</p>}
                  </div>
                </div>
                <div className="terminal-card p-3">
                  <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">MODEL TRANSPARENCY <span className="text-[#10B981]">{d.fallbackRate}% fallback</span></p>
                  <div className="mt-2 divide-y divide-[#10B9810F]">
                    {d.logs.map((l,i)=><div key={i} className="flex items-center justify-between py-1.5 font-mono text-xs"><span className="text-[#C9DCD2]">{l.task} · {l.provider}</span><span className={l.fallback_used?"text-[#FBBF24]":"text-[#10B981]"}>{l.fallback_used?"fallback":"primary"}</span></div>)}
                    {d.logs.length===0&&<p className="py-2 font-mono text-xs text-[#8BA494]">No AI calls yet.</p>}
                  </div>
                  <div className="mt-3 rounded-lg border border-[#10B98114] bg-[#060D0A] p-3">
                    <p className="font-mono text-xs text-[#38BDF8]">◎ Calibration Terminal</p>
                    <p className="font-mono text-[11px] text-[#10B981]">&gt; {d.adapt.reason ?? "No adaptation needed"}</p>
                    <p className="font-mono text-[11px] text-[#8BA494]">Streak: {d.streak} Days · XP {d.xp}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
