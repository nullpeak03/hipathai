"use client";
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
  useEffect(()=>{(async()=>{try{const j=await fetch("/api/me/diagnostics").then(r=>r.json());setLogs(j.logs??[]);}catch{setLogs([]);}})()},[]);
  async function regen(){setMsg("");const r=await fetch("/api/me/regenerate",{method:"POST"});if(r.ok)router.push("/onboarding");else setMsg("Regenerate failed. Retry.");}
  return (
    <div className="flex min-h-screen bg-[#050A08] text-[#E6F4ED]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#10B98112] bg-[#050A08] p-3 md:flex">
        <Link href="/app/dashboard" className="rounded-lg border border-[#10B98114] bg-[#0A120E] px-3 py-2 font-mono text-xs text-[#8BA494]">← Dashboard</Link>
        <p className="mt-4 font-mono text-[10px] tracking-widest text-[#8BA494]">SETTINGS</p>
        <p className="font-display text-sm font-bold">Control</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#10B98112] bg-[#050A08]/90 px-3 py-2 backdrop-blur">
          <p className="font-mono text-xs text-[#8BA494]">SETTINGS // control_v1</p>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 p-4">
          <h1 className="font-display text-xl font-bold">Settings</h1>
          <div className="terminal-card mt-3 p-4">
            <p className="font-mono text-[10px] tracking-widest text-[#10B981]">PATH</p>
            <p className="mt-1 font-mono text-xs text-[#8BA494]">Regenerating archives the current path (v+1 on next generate).</p>
            <button onClick={()=>void regen()} className="mt-3 rounded-lg bg-[#10B981] px-4 py-2 font-mono text-xs font-bold text-[#050A08]">Regenerate Path</button>
            {msg&&<span className="ml-2 font-mono text-xs text-[#F87171]">{msg}</span>}
          </div>
          <div className="terminal-card mt-3 p-4">
            <p className="font-mono text-[10px] tracking-widest text-[#10B981]">PWA + SESSION</p>
            <div className="mt-2"><InstallButton /></div>
            {clerkKey?<SignOutButton />:<Link href="/" className="mt-2 inline-block rounded-lg border border-[#10B98114] px-4 py-2 font-mono text-xs">Back home (auth preview)</Link>}
          </div>
          <div className="terminal-card mt-3 p-4">
            <p className="font-mono text-[10px] tracking-widest text-[#10B981]">DIAGNOSTICS · ai_logs</p>
            {!logs&&<p className="mt-2 animate-pulse font-mono text-xs text-[#8BA494]">loading…</p>}
            {logs&&logs.length===0&&<p className="mt-2 font-mono text-xs text-[#8BA494]">No AI calls yet.</p>}
            {logs&&logs.length>0&&<div className="mt-2 divide-y divide-[#10B9810F] font-mono text-xs">{logs.map((l,i)=><div key={i} className="flex items-center justify-between gap-2 py-1.5"><span className="text-[#C9DCD2]">{l.task} · {l.provider} · {l.latency_ms}ms</span><span className={l.fallback_used?"text-[#FBBF24]":"text-[#10B981]"}>{l.fallback_used?"fallback":"primary"}{l.error_code?` · ${l.error_code.slice(0,24)}`:""}</span></div>)}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}
function SignOutButton(){
  const router=useRouter();
  const {signOut}=useClerk();
  return (<button onClick={()=>void signOut(()=>router.push("/"))} className="mt-2 rounded-lg border border-[#10B98114] bg-[#0A120E] px-4 py-2 font-mono text-xs">Sign out</button>);
}
