"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
type Lesson={objectives:string[];md:string;keyPoints:string[];codeExamples:{lang:string;code:string;note?:string}[];videos:{title:string;videoId:string;channel?:string}[]};
type PubQ={index:number;q:string;type:string;options:string[]|null};
type GradeResult={score:number;pass:boolean;correct:number;total:number;results:{index:number;correct:boolean;explanation:string}[];weak:boolean;unlockedNext:number|null;attempts:number};
function copyText(t:string){try{void navigator.clipboard.writeText(t);}catch{}}
export default function LessonPlayer(){
  const {id,order}=useParams<{id:string;order:string}>();
  const ord=Number(order);
  const [lesson,setLesson]=useState<Lesson|null>(null);
  const [fast,setFast]=useState(false);
  const [err,setErr]=useState("");
  const [tab,setTab]=useState<"video"|"summary"|"notes">("video");
  const [notes,setNotes]=useState(()=>{try{return typeof window!=="undefined"?localStorage.getItem(`hipath-notes-${id}-${order}`)??"":"";}catch{return ""}});
  const [quizOpen,setQuizOpen]=useState(false);
  const [questions,setQuestions]=useState<PubQ[]|null>(null);
  const [answers,setAnswers]=useState<Record<number,number|string>>({});
  const [grade,setGrade]=useState<GradeResult|null>(null);
  const [quizBusy,setQuizBusy]=useState(false);
  const [quizErr,setQuizErr]=useState("");
  const [queued,setQueued]=useState(false);
  const noteKey=`hipath-notes-${id}-${order}`; const queueKey="hipath-quiz-queue";
  useEffect(()=>{(async()=>{try{const raw=localStorage.getItem(queueKey);if(!raw)return;const pending=JSON.parse(raw) as {roadmapId:string;order:number;answers:(number|string)[]}[];const mine=pending.filter(p=>p.roadmapId===id&&p.order===ord);if(!mine.length)return;for(const p of mine){try{const res=await fetch("/api/quiz/grade",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)});if(res.ok){const j=await res.json();setGrade(j);setQuizOpen(true);}}catch{}}localStorage.setItem(queueKey,JSON.stringify(pending.filter(p=>!(p.roadmapId===id&&p.order===ord))));setQueued(false);}catch{}})()},[id,ord,queueKey]);
  const loadLesson=useCallback(async()=>{setErr("");try{const res=await fetch("/api/lessons/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roadmapId:id,order:ord})});const j=await res.json();if(!res.ok){setErr(j.message??j.error??"Lesson failed to load.");return;}if(j.fallback)setFast(true);setLesson(j.lesson);}catch{setErr("Network error. Retry.");}},[id,ord]);
  useEffect(()=>{const t=setTimeout(()=>void loadLesson(),0);return()=>clearTimeout(t);},[loadLesson]);
  useEffect(()=>{const t=setTimeout(()=>{try{localStorage.setItem(noteKey,notes);}catch{}},400);return()=>clearTimeout(t);},[notes,noteKey]);
  async function openQuiz(){setQuizOpen(true);setQuizErr("");setGrade(null);if(questions)return;setQuizBusy(true);try{const res=await fetch("/api/quiz/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roadmapId:id,order:ord})});const j=await res.json();if(!res.ok){setQuizErr(j.message??j.error??"Quiz failed to generate.");return;}setQuestions(j.questions);setAnswers({});}catch{setQuizErr("Network error. Retry.");}finally{setQuizBusy(false);}}
  async function regenQuiz(){setQuestions(null);setGrade(null);setQuizErr("");setQuizBusy(true);try{const res=await fetch("/api/quiz/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roadmapId:id,order:ord})});const j=await res.json();if(!res.ok){setQuizErr(j.message??j.error??"Quiz failed to generate.");return;}setQuestions(j.questions);setAnswers({});}catch{setQuizErr("Network error. Retry.");}finally{setQuizBusy(false);}}
  async function submitQuiz(){if(!questions)return;setQuizBusy(true);setQuizErr("");const payload={roadmapId:id,order:ord,answers:questions.map((q)=>answers[q.index]??(q.type==="mcq"?-1:""))};try{const res=await fetch("/api/quiz/grade",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const j=await res.json();if(!res.ok){setQuizErr(j.message??j.error??"Grading failed.");return;}setGrade(j);}catch{try{const raw=localStorage.getItem(queueKey);const q=raw?JSON.parse(raw):[];localStorage.setItem(queueKey,JSON.stringify([...q,payload]));setQueued(true);setQuizErr("Offline — answers queued on this device, will sync when you're back.");}catch{setQuizErr("Network error. Retry.");}}finally{setQuizBusy(false);}}
  return (
    <div className="flex min-h-screen bg-[#050A08] text-[#E6F4ED]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#10B98112] bg-[#050A08] p-3 md:flex">
        <Link href="/app/dashboard" className="rounded-lg border border-[#10B98114] bg-[#0A120E] px-3 py-2 font-mono text-xs text-[#8BA494]">← Path</Link>
        <p className="mt-4 font-mono text-[10px] tracking-widest text-[#8BA494]">ACTIVE LESSON</p>
        <p className="mt-1 font-display text-sm font-bold">Lesson {order} {fast&&<span className="rounded bg-[#FBBF2422] px-1 py-0.5 font-mono text-[10px] text-[#FBBF24]">fast mode</span>}</p>
        <div className="mt-4 space-y-2">
          <Link href={`/app/tutor?roadmapId=${id}&order=${order}`} className="block rounded-lg bg-[#10B981] px-3 py-2 text-center font-mono text-xs font-bold text-[#050A08]">Ask AI Tutor →</Link>
          <Link href={`/app/roadmap/${id}`} className="block rounded-lg border border-[#10B98114] bg-[#0A120E] px-3 py-2 text-center font-mono text-xs text-[#8BA494]">Back to Roadmap</Link>
        </div>
        <div className="mt-auto rounded-lg border border-[#10B98114] bg-[#0A120E] p-2.5">
          <p className="font-mono text-[11px] text-[#10B981]">● Practice gated</p>
          <p className="font-mono text-[11px] text-[#8BA494]">70% to unlock next · {queued?"1 queued offline":""}</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[#10B98112] bg-[#050A08]/90 px-3 py-2 backdrop-blur">
          <Link href={`/app/roadmap/${id}`} className="font-mono text-xs text-[#8BA494] hover:text-[#E6F4ED]">← Path</Link>
          <span className="font-mono text-xs text-[#8BA494]">lesson {order}{fast&&<span className="ml-2 rounded-full bg-[#FBBF2422] px-2 py-0.5 text-[#FBBF24]">fast mode</span>}</span>
          <Link href={`/app/tutor?roadmapId=${id}&order=${order}`} className="font-mono text-xs text-[#10B981] hover:text-[#34D399]">Ask Tutor →</Link>
        </header>
        {err&&<div className="mx-3 mt-3 rounded-lg border border-[#F8717155] bg-[#F8717111] p-3 font-mono text-xs text-[#F87171]">{err} <button onClick={loadLesson} className="ml-2 rounded bg-[#10B981] px-2 py-1 font-bold text-[#050A08]">Retry</button></div>}
        {!lesson&&!err&&<div className="grid flex-1 gap-3 p-3 md:grid-cols-[1.6fr_1fr]"><div className="terminal-card animate-pulse p-5"><div className="h-4 w-2/3 rounded bg-[#10B98122]" /></div><div className="terminal-card animate-pulse p-5" /></div>}
        {lesson&&(
          <div className="grid flex-1 gap-3 p-3 md:grid-cols-[1.6fr_1fr]">
            <article className="terminal-card min-w-0 p-4 md:p-5">
              <p className="font-mono text-[10px] tracking-widest text-[#10B981]">ACTIVE LESSON NODE // {order}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-xs text-[#8BA494]">{lesson.objectives.map((o)=><li key={o}>{o}</li>)}</ul>
              <div className="prose-emerald mt-4 max-w-none text-[14px] leading-relaxed [&_code]:rounded [&_code]:bg-[#060D0A] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-[#6EE7B7] [&_h1]:font-display [&_h1]:text-lg [&_h1]:font-bold [&_h2]:font-display [&_h2]:text-base [&_h2]:font-bold [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-[#10B98114] [&_pre]:bg-[#060D0A] [&_pre]:p-3"><ReactMarkdown>{lesson.md}</ReactMarkdown></div>
              {lesson.codeExamples.length>0&&<div className="mt-4 space-y-2">{lesson.codeExamples.map((c,i)=><div key={i} className="overflow-hidden rounded-lg border border-[#10B98114] bg-[#060D0A]"><div className="flex items-center justify-between px-3 py-1.5"><span className="font-mono text-xs text-[#10B981]">{c.lang}</span><button onClick={()=>copyText(c.code)} className="font-mono text-xs text-[#8BA494] hover:text-[#E6F4ED]">copy</button></div><pre className="overflow-x-auto px-3 pb-3 font-mono text-xs text-[#C9DCD2]">{c.code}</pre>{c.note&&<p className="border-t border-[#10B9810F] px-3 py-2 font-mono text-[11px] text-[#8BA494]">{c.note}</p>}</div>)}</div>}
            </article>
            <aside className="flex min-h-0 flex-col gap-3">
              <div className="terminal-card p-3">
                <div className="flex gap-1 rounded-lg border border-[#10B98114] bg-[#0A120E] p-1">
                  {(["video","summary","notes"] as const).map((t)=><button key={t} onClick={()=>setTab(t)} className={`flex-1 rounded-md px-3 py-1.5 font-mono text-xs capitalize ${tab===t?"bg-[#10B98122] text-[#E6F4ED]":"text-[#8BA494]"}`}>{t}</button>)}
                </div>
                <div className="mt-3 min-h-48 rounded-lg border border-[#10B9810F] bg-[#060D0A] p-3">
                  {tab==="video"&& (lesson.videos.length===0?<p className="font-mono text-xs text-[#8BA494]">No verified videos — AI lesson covers it fully.</p>:<div className="space-y-3">{lesson.videos.map((v)=><div key={v.videoId}><p className="font-mono text-xs font-bold">{v.title}</p><div className="mt-1 overflow-hidden rounded-lg border border-[#10B98114]"><iframe className="aspect-video w-full" src={`https://www.youtube-nocookie.com/embed/${v.videoId}`} title={v.title} loading="lazy" allowFullScreen /></div>{v.channel&&<p className="font-mono text-[10px] text-[#8BA494]">{v.channel} · verified</p>}</div>)}</div>)}
                  {tab==="summary"&&<ul className="list-disc space-y-1 pl-5 font-mono text-xs text-[#C9DCD2]">{lesson.keyPoints.map((k)=><li key={k}>{k}</li>)}</ul>}
                  {tab==="notes"&&<textarea value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Your notes — autosaved…" rows={8} className="w-full resize-none rounded-lg border border-[#10B98114] bg-[#0A120E] p-3 font-mono text-xs outline-none placeholder:text-[#8BA49466] focus:border-[#10B981]" />}
                </div>
                <button onClick={openQuiz} className="mt-3 w-full rounded-lg bg-[#10B981] px-4 py-2.5 font-mono text-xs font-bold text-[#050A08] hover:bg-[#34D399]">Generate Quiz →</button>
                <p className="text-center font-mono text-[11px] text-[#8BA494]">pass at 70% to unlock next{queued?" · 1 queued offline":""}</p>
              </div>
              <div className="terminal-card p-3">
                <p className="font-mono text-[10px] tracking-widest text-[#8BA494]">CALIBRATION TERMINAL</p>
                <p className="font-mono text-[11px] text-[#10B981]">&gt; {lesson.keyPoints[0]?.slice(0,60) ?? "Ready for quiz"}</p>
                <Link href={`/app/tutor?roadmapId=${id}&order=${order}`} className="mt-2 block rounded bg-[#0A120E] px-3 py-2 text-center font-mono text-xs text-[#10B981]">Open in AI Tutor →</Link>
              </div>
            </aside>
          </div>
        )}
        {quizOpen&&(
          <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 p-0 md:items-center md:p-6" onClick={()=>!quizBusy&&setQuizOpen(false)}>
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[#10B98133] bg-[#0A120E] p-5 md:rounded-2xl" onClick={(e)=>e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg font-bold">Quiz — lesson {order}</h2><button onClick={()=>!quizBusy&&setQuizOpen(false)} className="text-[#8BA494]">✕</button></div>
              {quizBusy&&!questions&&<p className="animate-pulse font-mono text-xs text-[#10B981]">Generating questions… ▊</p>}
              {quizErr&&<div className="rounded-lg border border-[#F8717155] bg-[#F8717111] p-3 font-mono text-xs text-[#F87171]">{quizErr} <button onClick={regenQuiz} className="ml-2 rounded bg-[#10B981] px-2 py-1 font-bold text-[#050A08]">Retry</button></div>}
              {questions&&!grade&&<div className="space-y-4">{questions.map((q)=><div key={q.index}><p className="font-mono text-xs font-bold">{q.index+1}. {q.q}</p>{q.type==="mcq"&&q.options?<div className="mt-2 space-y-1.5">{q.options.map((o,oi)=><label key={oi} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs ${answers[q.index]===oi?"border-[#10B981] bg-[#10B98118]":"border-[#10B98114]"}`}><input type="radio" name={`q-${q.index}`} checked={answers[q.index]===oi} onChange={()=>setAnswers((a)=>({...a,[q.index]:oi}))} className="accent-[#10B981]" />{o}</label>)}</div>:<input value={(answers[q.index] as string)??""} onChange={(e)=>setAnswers((a)=>({...a,[q.index]:e.target.value}))} placeholder="Exact output…" className="mt-2 w-full rounded-lg border border-[#10B98133] bg-[#060D0A] px-3 py-2 font-mono text-xs outline-none focus:border-[#10B981]" />}</div>)}<button onClick={submitQuiz} disabled={quizBusy||questions.some((q)=>answers[q.index]===undefined)} className="w-full rounded-lg bg-[#10B981] px-4 py-2.5 font-mono text-xs font-bold text-[#050A08] disabled:opacity-40">Submit Quiz</button></div>}
              {grade&&<div><div className={`rounded-lg p-4 text-center ${grade.pass?"bg-[#10B98122]":"bg-[#FBBF2422]"}`}><p className="font-display text-2xl font-bold">{grade.score}%</p><p className="font-mono text-xs">{grade.pass?"Passed — next unlocked ✓":`Weak — ${grade.correct}/${grade.total} correct`}</p></div><div className="mt-3 space-y-2">{grade.results.map((r)=><div key={r.index} className={`rounded-lg border p-3 font-mono text-xs ${r.correct?"border-[#10B98133] text-[#34D399]":"border-[#F8717155] text-[#F87171]"}`}>Q{r.index+1} — {r.correct?"correct":"missed"}<p className="text-[#8BA494]">{r.explanation}</p></div>)}</div><div className="mt-4 flex gap-2">{grade.pass&&grade.unlockedNext!==null?<Link href={`/app/lesson/${id}/${grade.unlockedNext}`} className="flex-1 rounded-lg bg-[#10B981] px-4 py-2.5 text-center font-mono text-xs font-bold text-[#050A08]">Next Lesson →</Link>:!grade.pass?<button onClick={regenQuiz} className="flex-1 rounded-lg bg-[#10B981] px-4 py-2.5 font-mono text-xs font-bold text-[#050A08]">New Quiz, Retry</button>:null}<Link href={`/app/roadmap/${id}`} className="flex-1 rounded-lg border border-[#10B98114] px-4 py-2.5 text-center font-mono text-xs">Back to Path</Link></div></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
