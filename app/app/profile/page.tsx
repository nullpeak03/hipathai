"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InstallButton } from "@/components/InstallButton";
export default function Profile(){
  const router=useRouter();
  const [data,setData]=useState<{user:Record<string,unknown>|null;roadmap:{title:string;goal:string;version:number}|null}|null>(null);
  const [goal,setGoal]=useState("");
  const [hrs,setHrs]=useState(2);
  const [msg,setMsg]=useState("");
  const [confirmDel,setConfirmDel]=useState(false);
  useEffect(()=>{(async()=>{try{const j=await fetch("/api/me/profile").then(r=>r.json());setData(j);setGoal((j.roadmap?.goal??"") as string);setHrs(Number((j.user as {hrs_per_day?:number}|null)?.hrs_per_day??2));}catch{}})()},[]);
  async function save(){setMsg("");const r=await fetch("/api/me/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({goal:goal||undefined,hrsPerDay:hrs})});setMsg(r.ok?"Saved ✓":"Save failed. Retry.");}
  async function wipe(){if(!confirmDel){setConfirmDel(true);return;}await fetch("/api/me",{method:"DELETE"});router.push("/");}
  const user=(data?.user??{}) as {xp?:number;streak?:number;level?:string;track?:string};
  return (
    <div className="flex min-h-screen bg-[#050A08] text-[#E6F4ED]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#10B98112] bg-[#050A08] p-3 md:flex">
        <Link href="/app/dashboard" className="rounded-lg border border-[#10B98114] bg-[#0A120E] px-3 py-2 font-mono text-xs text-[#8BA494]">← Dashboard</Link>
        <p className="mt-4 font-mono text-[10px] tracking-widest text-[#8BA494]">ACCOUNT</p>
        <p className="font-display text-sm font-bold">Profile</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#10B98112] bg-[#050A08]/90 px-3 py-2 backdrop-blur">
          <p className="font-mono text-xs text-[#8BA494]">PROFILE // identity_v1</p>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 p-4">
          <h1 className="font-display text-xl font-bold">Profile</h1>
          <div className="terminal-card mt-3 p-4">
            <p className="font-mono text-[10px] tracking-widest text-[#10B981]">STATS</p>
            <p className="mt-2 font-mono text-xs">XP <span className="text-[#E6F4ED]">{user.xp??0}</span> · streak <span className="text-[#E6F4ED]">{user.streak??0}d</span></p>
            <p className="mt-1 font-mono text-xs text-[#8BA494]">{user.track??"—"} · {user.level??"—"} · path v{data?.roadmap?.version??1}</p>
            {data?.roadmap&&<p className="mt-1 font-mono text-xs text-[#8BA494]">{data.roadmap.title}</p>}
          </div>
          <div className="terminal-card mt-3 p-4">
            <p className="font-mono text-[10px] tracking-widest text-[#10B981]">GOAL + HOURS</p>
            <input value={goal} onChange={(e)=>setGoal(e.target.value)} className="mt-2 w-full rounded-lg border border-[#10B98133] bg-[#060D0A] px-4 py-2.5 font-mono text-xs outline-none focus:border-[#10B981]" />
            <label className="mt-3 block font-mono text-xs text-[#8BA494]">Hours / day: <span className="text-[#E6F4ED]">{hrs}h</span><input type="range" min={1} max={8} value={hrs} onChange={(e)=>setHrs(Number(e.target.value))} className="mt-2 w-full accent-[#10B981]" /></label>
            <button onClick={()=>void save()} className="mt-3 rounded-lg bg-[#10B981] px-4 py-2 font-mono text-xs font-bold text-[#050A08]">Save</button>
            {msg&&<span className="ml-2 font-mono text-xs text-[#10B981]">{msg}</span>}
          </div>
          <div className="terminal-card mt-3 p-4">
            <p className="font-mono text-[10px] tracking-widest text-[#10B981]">APP</p>
            <div className="mt-2"><InstallButton /></div>
            <div className="mt-3 flex gap-2">
              <a href="/api/me" download="hipath-export.json" className="flex-1 rounded-lg border border-[#10B98114] bg-[#0A120E] px-4 py-2.5 text-center font-mono text-xs">Export JSON</a>
              <button onClick={()=>void wipe()} className={`flex-1 rounded-lg px-4 py-2.5 font-mono text-xs font-bold ${confirmDel?"bg-[#F87171] text-[#050A08]":"border border-[#F8717155] text-[#F87171]"}`}>{confirmDel?"Confirm delete everything":"Delete account"}</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
