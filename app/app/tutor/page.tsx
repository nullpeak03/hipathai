"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
type Msg={role:"user"|"assistant";content:string};
type Thread={id:string;node_order:number|null;roadmap_id:string|null;title:string|null;language:string|null;messages:Msg[];created_at:string;updated_at:string|null};
const LANGS=["python","javascript","typescript","java","go","rust","c","cpp","csharp","php","ruby","swift","kotlin","bash","sql"] as const;
async function fetchThreads(roadmapId:string):Promise<Thread[]>{try{const r=await fetch(`/api/tutor/threads?roadmapId=${roadmapId}`);const j=await r.json();return j.threads??[];}catch{return[]}}
async function fetchThread(id:string):Promise<Msg[]>{try{const r=await fetch(`/api/tutor/threads?roadmapId=${id}`);return []}catch{return[]}}
export default function TutorPage(){return (<Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#050A08] font-mono text-sm text-[#10B981]">loading tutor…</div>}><TutorInner /></Suspense>);}
function TutorInner(){
  const params=useSearchParams();
  const [roadmapId,setRoadmapId]=useState(params.get("roadmapId")??"");
  const [order,setOrder]=useState(Number(params.get("order")??0));
  const [threadId,setThreadId]=useState<string|null>(params.get("threadId"));
  const [nodes,setNodes]=useState<{order:number;title:string;phase?:string}[]>([]);
  const [activeTitle,setActiveTitle]=useState("Python Decorators");
  const [msgs,setMsgs]=useState<Msg[]>([]);
  const [threads,setThreads]=useState<Thread[]>([]);
  const [input,setInput]=useState("");
  const [busy,setBusy]=useState(false);
  const [fast,setFast]=useState(false);
  const [err,setErr]=useState("");
  const [log,setLog]=useState("");
  const [lang,setLang]=useState("python");
  const [scratch,setScratch]=useState(`# Verify metadata preservation\nimport functools\nimport time\n\ndef timer(func):\n    @functools.wraps(func)\n    def wrapper(*args, **kwargs):\n        start=time.time()\n        res=func(*args,**kwargs)\n        print(f"{func.__name__} took {time.time()-start:.4f}s")\n        return res\n    return wrapper\n\n@timer\ndef train_epoch():\n    """Trains single epoch"""\n    pass\n\nprint(train_epoch.__name__)`); 
  const [stdin,setStdin]=useState("");
  const [termOut,setTermOut]=useState("> python scratchpad.py\ntrain_epoch # Verified: __name__ preserved! ✔");
  const [runBusy,setRunBusy]=useState(false);
  const [search,setSearch]=useState("");
  const bottom=useRef<HTMLDivElement>(null);
  useEffect(()=>{(async()=>{
    try{
      const me=await fetch("/api/me/active").then(r=>r.json());
      const id=params.get("roadmapId")??me.activeId??"";
      setRoadmapId(id);
      if(!id) return;
      const rm=await fetch(`/api/roadmaps/${id}`).then(r=>r.json());
      const ns=(rm.nodes??[]).map((n:{order:number;title:string;phase?:string})=>({order:n.order,title:n.title,phase:n.phase}));
      setNodes(ns);
      const cur=ns.find((n:{order:number})=>n.order===order)??ns[0];
      if(cur){setActiveTitle(cur.title);}
      const th=await fetch(`/api/tutor/threads?roadmapId=${id}`).then(r=>r.json()).catch(()=>({threads:[]}));
      setThreads((th.threads??[]).slice(0,20));
      if(params.get("threadId")){
        const tid=params.get("threadId")!;
        const t=th.threads.find((x:Thread)=>x.id===tid);
        if(t){setThreadId(tid); setMsgs(t.messages??[]); if(t.language) setLang(t.language);}
      } else if(th.threads[0]){
        setMsgs(th.threads[0].messages??[]);
        setThreadId(th.threads[0].id);
        if(th.threads[0].language) setLang(th.threads[0].language);
      }
    }catch{}
  })()},[params,order]);
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:"smooth"})},[msgs]);
  const newChat=useCallback(async()=>{
    if(!roadmapId) return;
    const res=await fetch("/api/tutor/threads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roadmapId,node_order:order,language:lang,title:"New chat"})});
    const j=await res.json();
    if(j.id){setThreadId(j.id); setMsgs([]); const th=await fetch(`/api/tutor/threads?roadmapId=${roadmapId}`).then(r=>r.json()).catch(()=>({threads:[]})); setThreads(th.threads??[]);}
  },[roadmapId,order,lang]);
  const runScratch=useCallback(async()=>{
    setRunBusy(true);
    try{
      const res=await fetch("/api/run",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({language:lang,code:scratch,stdin})});
      const j=await res.json();
      if(!res.ok) throw new Error(j.detail||j.error||"Failed");
      const out=(j.stdout||"")+(j.stderr?"\n"+j.stderr:"");
      setTermOut(`> ${lang} scratchpad\n${out||"(no output)"}\nExit ${j.code}`);
    }catch(e){
      setTermOut(`Error: ${e instanceof Error?e.message:String(e)}`);
    }finally{setRunBusy(false);}
  },[lang,scratch,stdin]);
  const send=useCallback(async()=>{
    const text=input.trim();
    if(!text||busy||!roadmapId) return;
    setBusy(true);setErr("");setFast(false);setLog("");
    setMsgs((m)=>[...m,{role:"user",content:text}]);
    setInput("");
    let acc=""; setMsgs((m)=>[...m,{role:"assistant",content:""}]);
    try{
      const res=await fetch("/api/tutor/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roadmapId,order,message:text,threadId:threadId??undefined,language:lang})});
      if(!res.ok||!res.body){const j=await res.json().catch(()=>({})); throw new Error((j.message??j.error??`http_${res.status}`) as string);}
      const reader=res.body.getReader(); const dec=new TextDecoder(); let buf=""; let event="";
      const apply=(raw:string)=>{
        if(raw.startsWith("event:")){event=raw.slice(6).trim();return;}
        if(raw.startsWith("data:")){
          const payload=raw.slice(5).trim();
          if(event==="meta"){try{const m=JSON.parse(payload);if(m.fallback){setFast(true);setLog(m.note??"Switched to fast mode…");}}catch{}}
          else if(event==="token"){try{const d=JSON.parse(payload) as {t?:string}; if(d.t){acc+=d.t; const snap=acc; setMsgs((m)=>{const c=[...m]; c[c.length-1]={role:"assistant",content:snap};return c;});}}catch{}}
          else if(event==="error"){throw new Error(JSON.parse(payload).detail??"nim_all_failed");}
          event="";
        }
      };
      for(;;){const {done,value}=await reader.read(); if(done)break; buf+=dec.decode(value,{stream:true}); const lines=buf.split("\n"); buf=lines.pop()??""; for(const l of lines) if(l.trim()) apply(l.trim());}
      if(!acc) throw new Error("Empty reply — Retry.");
      // refresh threads
      const th=await fetch(`/api/tutor/threads?roadmapId=${roadmapId}`).then(r=>r.json()).catch(()=>({threads:[]})); setThreads(th.threads??[]);
    }catch(e){
      const msg=e instanceof Error?e.message:"failed"; setErr(msg); setMsgs((m)=>m.slice(0,-1));
    }finally{setBusy(false);}
  },[input,busy,roadmapId,order,threadId,lang]);
  const filtered=threads.filter(t=>!search||t.title?.toLowerCase().includes(search.toLowerCase())||t.messages[0]?.content.toLowerCase().includes(search.toLowerCase()));
  const grouped:Record<string,Thread[]>={Today:[],Yesterday:[],Previous:[]};
  filtered.forEach(t=>{
    const d=new Date(t.updated_at||t.created_at); const now=new Date(); const diff=(now.getTime()-d.getTime())/86400000;
    if(diff<1) grouped.Today.push(t); else if(diff<2) grouped.Yesterday.push(t); else grouped.Previous.push(t);
  });
  return (
    <div className="flex min-h-screen bg-[#050A08] text-[#E6F4ED]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#10B98112] bg-[#050A08] p-3 md:flex">
        <div className="rounded-lg border border-[#10B98114] bg-[#0A120E] px-3 py-2">
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#8BA494]"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></span> workspace <span className="text-[#10B981]">&gt;</span></div>
          <div className="font-mono text-xs text-[#10B981]">/ learn_to_ship()</div>
        </div>
        <button onClick={newChat} className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-[#10B981] px-3 py-2 font-mono text-xs font-bold text-[#050A08] hover:bg-[#34D399]">+ New chat</button>
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search chats…" className="mt-2 w-full rounded-lg border border-[#10B98114] bg-[#0A120E] px-3 py-1.5 font-mono text-xs outline-none placeholder:text-[#8BA49466] focus:border-[#10B981]" />
        <nav className="mt-3 flex-1 space-y-4 overflow-y-auto text-[13px]">
          {Object.entries(grouped).map(([label, list])=> list.length?(
            <div key={label}>
              <p className="px-2 font-mono text-[10px] tracking-widest text-[#8BA494]">{label}</p>
              <div className="mt-1 space-y-1">
                {list.map((t)=>(
                  <button key={t.id} onClick={()=>{setThreadId(t.id); setMsgs(t.messages??[]); if(t.language) setLang(t.language);}} className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-[#0A120E] ${threadId===t.id?"bg-[#10B98114] text-[#E6F4ED]":"text-[#8BA494]"}`}>
                    <span className="truncate font-mono text-xs">{t.title||"New chat"}</span>
                    <span className="shrink-0 font-mono text-[10px]">{t.language||"py"}</span>
                  </button>
                ))}
              </div>
            </div>
          ):null)}
          <div>
            <p className="px-2 font-mono text-[10px] tracking-widest text-[#8BA494]">MAIN</p>
            <div className="mt-1 space-y-0.5">
              <Link href="/app/dashboard" className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:bg-[#0A120E] hover:text-[#E6F4ED]">▦ Dashboard</Link>
              <Link href={roadmapId?`/app/roadmap/${roadmapId}`:"/onboarding"} className="flex items-center gap-2 rounded px-2 py-1.5 text-[#8BA494] hover:text-[#E6F4ED]">↗ Roadmap</Link>
              <p className="flex items-center gap-2 rounded bg-[#10B98114] px-2 py-1.5 text-[#E6F4ED]">◈ AI Tutor</p>
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
            <select value={lang} onChange={(e)=>setLang(e.target.value)} className="rounded border border-[#10B98114] bg-[#0A120E] px-2 py-1 font-mono text-xs outline-none">
              {LANGS.map((l)=><option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-[#10B98122] bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#10B981]">● v1 · free forever</span>
            <span className="hidden rounded border border-[#10B98122] bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#E6F4ED] md:block">14 days streak 🔥</span>
          </div>
        </header>
        <div className="flex flex-wrap items-center gap-2 border-b border-[#10B9810F] bg-[#070D0A] px-3 py-2">
          <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#10B981]">● SESSION // socratic_tutor_v2.1</span>
          <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#8BA494]">ROADMAP: <span className="text-[#E6F4ED]">AI ENGINEERING</span> / PHASE 1</span>
          <span className="rounded bg-[#0A120E] px-2 py-1 font-mono text-[11px] text-[#38BDF8]">◎ Socratic Mode: Guides, Never Spoils</span>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 p-3 md:grid-cols-[260px_1fr_300px]">
          <div className="space-y-3">
            <div className="terminal-card p-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">ACTIVE LESSON NODE</p>
                <span className="rounded border border-[#10B98133] bg-[#10B98114] px-2 py-0.5 font-mono text-[10px] text-[#10B981]">In Progress</span>
              </div>
              <p className="mt-2 font-mono text-xs text-[#10B981]">&gt; {activeTitle}</p>
              <p className="font-mono text-[11px] text-[#8BA494]">Lesson {order+1} · Scope, Closures & Metaprogramming</p>
              <select value={order} onChange={(e)=>setOrder(Number(e.target.value))} className="mt-2 w-full rounded-lg border border-[#10B98114] bg-[#060D0A] px-2 py-1.5 font-mono text-xs outline-none">
                {nodes.map((n)=><option key={n.order} value={n.order}>L{n.order} · {n.title.slice(0,28)}</option>)}
                {nodes.length===0&&<option value={0}>lesson 0</option>}
              </select>
            </div>
            <div className="terminal-card p-3">
              <p className="flex items-center justify-between font-mono text-[10px] tracking-widest text-[#8BA494]">TUTOR CALIBRATION <span>≣</span></p>
              <div className="mt-2 rounded bg-[#0A120E] p-2">
                <p className="font-mono text-xs font-bold text-[#E6F4ED]">Strict Hinting</p>
                <p className="font-mono text-[11px] text-[#8BA494]">Zero copy-paste solutions</p>
              </div>
              <p className="mt-2 flex justify-between font-mono text-[11px]"><span className="text-[#8BA494]">Fallback to Fast Mode</span><span className="text-[#10B981]">Enabled</span></p>
              {fast&&<p className="mt-1 font-mono text-[11px] text-[#FBBF24]">● Fast mode active ✓</p>}
            </div>
          </div>
          <div className="flex min-h-0 flex-col gap-3">
            <div className="terminal-card p-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs font-bold text-[#10B981]">A tutor that <span className="text-[#E6F4ED]">guides, never spoils</span></p>
                <span className="font-mono text-[11px] text-[#8BA494]">↻ 🔊</span>
              </div>
              <p className="font-mono text-[11px] text-[#8BA494]">Context: {activeTitle} · Scope & Closures · {lang} · Fast Mode Active ✓</p>
            </div>
            <div className="terminal-card flex min-h-[420px] flex-1 flex-col p-3">
              <p className="rounded-full bg-[#0A120E] px-3 py-1.5 text-center font-mono text-[11px] text-[#8BA494]">● Socratic mode active: asks before it tells · knows quiz failures</p>
              <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
                {log&&<p className="font-mono text-xs text-[#FBBF24]">&gt; {log}</p>}
                {msgs.length===0&&<div className="rounded-lg bg-[#0A120E] p-3 text-center font-mono text-xs text-[#8BA494]">Ask about {activeTitle} — I guide with questions first, never spoil.</div>}
                {msgs.map((m,i)=>(
                  <div key={i} className={m.role==="user"?"flex justify-end":"flex justify-start"}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role==="user"?"bg-[#10B98122] text-[#E6F4ED]":"bg-[#060D0A] text-[#C9DCD2]"}`}>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content||(busy&&i===msgs.length-1?"▊ thinking…":"")}</p>
                    </div>
                  </div>
                ))}
                {err&&<div className="rounded-lg border border-[#F8717155] bg-[#F8717111] p-3 font-mono text-xs text-[#F87171]">{err}</div>}
                <div ref={bottom} />
              </div>
              <div className="mt-3 rounded-lg border border-[#10B98114] bg-[#0A120E] p-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[#10B981]">&gt;</span>
                  <input value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&void send()} placeholder={`ask_tutor(scope="${activeTitle.toLowerCase().replace(/[^a-z]+/g,"_").slice(0,16)}")`} className="flex-1 bg-transparent font-mono text-xs text-[#E6F4ED] placeholder:text-[#8BA49466] outline-none" />
                </div>
                <textarea value={input} onChange={(e)=>setInput(e.target.value)} placeholder="Type your doubt or logic here… HiPath asks questions before giving direct answers." rows={2} className="mt-2 w-full resize-none bg-transparent font-mono text-xs text-[#8BA494] placeholder:text-[#8BA49466] outline-none" />
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[#8BA494]">&lt;&gt; Snippet  {"{}"} Attach Stack</span>
                  <button onClick={()=>void send()} disabled={busy||!input.trim()||!roadmapId} className="rounded bg-[#10B981] px-4 py-1.5 font-mono text-xs font-bold text-[#050A08] disabled:opacity-40 hover:bg-[#34D399]">{busy?"…":"Send Query ↑"}</button>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="terminal-card p-0">
              <div className="flex items-center justify-between border-b border-[#10B9810F] px-3 py-2">
                <p className="flex items-center gap-2 font-mono text-[11px]"><span className="h-2 w-2 rounded-full bg-[#F87171]"></span><span className="h-2 w-2 rounded-full bg-[#FBBF24]"></span><span className="h-2 w-2 rounded-full bg-[#10B981]"></span> scratchpad.{lang==="python"?"py":lang==="javascript"?"js":lang}</p>
                <button onClick={runScratch} disabled={runBusy} className="rounded bg-[#10B981] px-2 py-1 font-mono text-xs font-bold text-[#050A08] disabled:opacity-50">▶ Run</button>
              </div>
              <textarea value={scratch} onChange={(e)=>setScratch(e.target.value)} rows={12} className="w-full bg-[#060D0A] p-3 font-mono text-[12px] leading-relaxed text-[#E6F4ED] outline-none" />
              <textarea value={stdin} onChange={(e)=>setStdin(e.target.value)} placeholder="stdin (optional) — like Programiz input" rows={2} className="w-full border-t border-[#10B9810F] bg-[#0A120E] p-2 font-mono text-xs outline-none placeholder:text-[#8BA49466]" />
              <div className="border-t border-[#10B9810F] p-3">
                <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">TERMINAL OUTPUT <span className="text-[#10B981]">● Exit {runBusy?"…":"0"}</span></p>
                <pre className="mt-1 max-h-32 overflow-y-auto rounded bg-[#0A120E] p-2 font-mono text-[11px] text-[#10B981]">{termOut}</pre>
              </div>
            </div>
            <div className="terminal-card p-3">
              <p className="flex items-center gap-2 font-mono text-xs font-bold"><span className="text-[#10B981]">🔒</span> QUIZ GATE: UNLOCK NEXT <span className="ml-auto font-mono text-[11px] font-normal text-[#8BA494]">70% to Pass</span></p>
              <p className="mt-2 font-mono text-[11px] text-[#8BA494]">Complete the 3-question micro quiz to verify decorator closures and unlock next.</p>
              <Link href={roadmapId?`/app/lesson/${roadmapId}/${order}`:"/app/dashboard"} className="mt-3 flex w-full items-center justify-between rounded bg-[#10B981] px-3 py-2 font-mono text-xs font-bold text-[#050A08]">Start Quiz Gate (3 min) <span>→</span></Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
