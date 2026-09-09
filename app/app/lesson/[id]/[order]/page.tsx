"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";

type Lesson = {
  objectives: string[];
  md: string;
  keyPoints: string[];
  codeExamples: { lang: string; code: string; note?: string }[];
  videos: { title: string; videoId: string; channel?: string }[];
};

type PubQ = { index: number; q: string; type: string; options: string[] | null };

type GradeResult = {
  score: number; pass: boolean; correct: number; total: number;
  results: { index: number; correct: boolean; explanation: string }[];
  weak: boolean; unlockedNext: number | null; attempts: number;
};

function copyText(t: string) {
  try {
    void navigator.clipboard.writeText(t);
  } catch { /* clipboard unavailable */ }
}

export default function LessonPlayer() {
  const { id, order } = useParams<{ id: string; order: string }>();
  const ord = Number(order);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [fast, setFast] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"video" | "summary" | "notes">("video");
  // Notes restore synchronously at init (no mount-effect setState).
  const [notes, setNotes] = useState(() => {
    try {
      return typeof window !== "undefined" ? (localStorage.getItem(`hipath-notes-${id}-${order}`) ?? "") : "";
    } catch {
      return "";
    }
  });

  const [quizOpen, setQuizOpen] = useState(false);
  const [questions, setQuestions] = useState<PubQ[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number | string>>({});
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [quizBusy, setQuizBusy] = useState(false);
  const [quizErr, setQuizErr] = useState("");
  const [queued, setQueued] = useState(false);

  const noteKey = `hipath-notes-${id}-${order}`;
  const queueKey = "hipath-quiz-queue";

  // Offline queue: flush pending grade submissions when back online (PWA sync)
  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(queueKey);
        if (!raw) return;
        const pending = JSON.parse(raw) as { roadmapId: string; order: number; answers: (number | string)[] }[];
        const mine = pending.filter((p) => p.roadmapId === id && p.order === ord);
        if (!mine.length) return;
        for (const p of mine) {
          try {
            const res = await fetch("/api/quiz/grade", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(p),
            });
            if (res.ok) {
              const j = await res.json();
              setGrade(j);
              setQuizOpen(true);
            }
          } catch { /* stays queued */ }
        }
        localStorage.setItem(queueKey, JSON.stringify(pending.filter((p) => !(p.roadmapId === id && p.order === ord))));
        setQueued(false);
      } catch { /* ignore */ }
    })();
  }, [id, ord, queueKey]);

  const loadLesson = useCallback(async () => {
    setErr("");
    try {
      const res = await fetch("/api/lessons/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roadmapId: id, order: ord }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.message ?? j.error ?? "Lesson failed to load.");
        return;
      }
      if (j.fallback) setFast(true);
      setLesson(j.lesson);
    } catch {
      setErr("Network error. Retry.");
    }
  }, [id, ord]);

  useEffect(() => {
    // Deferred so the fetch-setState cycle isn't a synchronous mount cascade.
    const t = setTimeout(() => void loadLesson(), 0);
    return () => clearTimeout(t);
  }, [loadLesson]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(noteKey, notes);
      } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(t);
  }, [notes, noteKey]);

  async function openQuiz() {
    setQuizOpen(true);
    setQuizErr("");
    setGrade(null);
    if (questions) return;
    setQuizBusy(true);
    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roadmapId: id, order: ord }),
      });
      const j = await res.json();
      if (!res.ok) {
        setQuizErr(j.message ?? j.error ?? "Quiz failed to generate.");
        return;
      }
      setQuestions(j.questions);
      setAnswers({});
    } catch {
      setQuizErr("Network error. Retry.");
    } finally {
      setQuizBusy(false);
    }
  }

  async function regenQuiz() {
    setQuestions(null);
    setGrade(null);
    setQuizErr("");
    setQuizBusy(true);
    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roadmapId: id, order: ord }),
      });
      const j = await res.json();
      if (!res.ok) {
        setQuizErr(j.message ?? j.error ?? "Quiz failed to generate.");
        return;
      }
      setQuestions(j.questions);
      setAnswers({});
    } catch {
      setQuizErr("Network error. Retry.");
    } finally {
      setQuizBusy(false);
    }
  }

  async function submitQuiz() {
    if (!questions) return;
    setQuizBusy(true);
    setQuizErr("");
    const payload = {
      roadmapId: id,
      order: ord,
      answers: questions.map((q) => answers[q.index] ?? (q.type === "mcq" ? -1 : "")),
    };
    try {
      const res = await fetch("/api/quiz/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        setQuizErr(j.message ?? j.error ?? "Grading failed.");
        return;
      }
      setGrade(j);
    } catch {
      // Offline: queue answers on-device, sync when back (PWA queue)
      try {
        const raw = localStorage.getItem(queueKey);
        const q = raw ? JSON.parse(raw) : [];
        localStorage.setItem(queueKey, JSON.stringify([...q, payload]));
        setQueued(true);
        setQuizErr("Offline — answers queued on this device, will sync when you're back.");
      } catch {
        setQuizErr("Network error. Retry.");
      }
    } finally {
      setQuizBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#050A08] text-[#E6F4ED]">
      <header className="flex items-center justify-between border-b border-[#10B98122] px-5 py-3">
        <Link href={`/app/roadmap/${id}`} className="text-sm text-[#8BA494] hover:text-[#E6F4ED]">← Path</Link>
        <span className="font-mono text-xs text-[#8BA494]">
          lesson {order}{fast && <span className="ml-2 rounded-full bg-[#FBBF2422] px-2 py-0.5 text-[#FBBF24]">fast mode</span>}
        </span>
        <Link href={`/app/tutor?roadmapId=${id}&order=${order}`} className="text-sm text-[#34D399] hover:text-[#E6F4ED]">Ask Tutor →</Link>
      </header>

      {err && (
        <div className="mx-auto mt-6 w-full max-w-6xl px-5">
          <div className="terminal-card border-[#F8717155] p-4">
            <p className="text-sm text-[#F87171]">{err}</p>
            <button onClick={loadLesson} className="mt-3 rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#050A08]">Retry Now</button>
          </div>
        </div>
      )}

      {!lesson && !err && (
        <div className="mx-auto grid w-full max-w-6xl flex-1 gap-4 px-5 py-6 md:grid-cols-[3fr_2fr]">
          {[0, 1].map((c) => (
            <div key={c} className="terminal-card animate-pulse space-y-3 p-5">
              <div className="h-4 w-2/3 rounded bg-[#10B98122]" />
              <div className="h-3 w-full rounded bg-[#10B98111]" />
              <div className="h-3 w-5/6 rounded bg-[#10B98111]" />
              <div className="h-3 w-4/6 rounded bg-[#10B98111]" />
            </div>
          ))}
        </div>
      )}

      {lesson && (
        <div className="mx-auto grid w-full max-w-6xl flex-1 gap-4 px-5 py-6 md:grid-cols-[3fr_2fr]">
          {/* left: lesson */}
          <article className="terminal-card min-w-0 p-5 md:p-6">
            <p className="font-mono text-xs text-[#34D399]">objectives</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#8BA494]">
              {lesson.objectives.map((o) => <li key={o}>{o}</li>)}
            </ul>
            <div className="prose-emerald mt-5 max-w-none text-[15px] leading-relaxed [&_h1]:font-display [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-[#E6F4ED] [&_h2]:font-display [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[#E6F4ED] [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-[#E6F4ED] [&_p]:mt-3 [&_p]:text-[#C9DCD2] [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-[#C9DCD2] [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:text-[#C9DCD2] [&_code]:rounded [&_code]:bg-[#060D0A] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-[#6EE7B7] [&_pre]:mt-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-[#10B98122] [&_pre]:bg-[#060D0A] [&_pre]:p-4 [&_strong]:text-[#E6F4ED]">
              <ReactMarkdown>{lesson.md}</ReactMarkdown>
            </div>
            {lesson.codeExamples.length > 0 && (
              <div className="mt-6 space-y-3">
                {lesson.codeExamples.map((c, i) => (
                  <div key={i} className="overflow-hidden rounded-lg border border-[#10B98122] bg-[#060D0A]">
                    <div className="flex items-center justify-between px-3 py-1.5">
                      <span className="font-mono text-xs text-[#34D399]">{c.lang}</span>
                      <button onClick={() => copyText(c.code)} className="font-mono text-xs text-[#8BA494] hover:text-[#E6F4ED]">copy</button>
                    </div>
                    <pre className="overflow-x-auto px-3 pb-3 font-mono text-[13px] text-[#C9DCD2]">{c.code}</pre>
                    {c.note && <p className="border-t border-[#10B98118] px-3 py-2 text-xs text-[#8BA494]">{c.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </article>

          {/* right: tabs */}
          <aside className="flex min-h-0 flex-col">
            <div className="flex gap-1 rounded-lg border border-[#10B98122] bg-[#0A120E] p-1">
              {(["video", "summary", "notes"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-[#10B98122] text-[#E6F4ED]" : "text-[#8BA494]"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="terminal-card mt-3 min-h-64 flex-1 p-4">
              {tab === "video" && (
                lesson.videos.length === 0 ? (
                  <p className="text-sm text-[#8BA494]">No verified videos for this lesson yet — the AI lesson covers it fully.</p>
                ) : (
                  <div className="space-y-4">
                    {lesson.videos.map((v) => (
                      <div key={v.videoId}>
                        <p className="mb-1.5 text-sm font-semibold">{v.title}</p>
                        <div className="overflow-hidden rounded-lg border border-[#10B98122]">
                          <iframe
                            className="aspect-video w-full"
                            src={`https://www.youtube-nocookie.com/embed/${v.videoId}`}
                            title={v.title}
                            loading="lazy"
                            allowFullScreen
                          />
                        </div>
                        {v.channel && <p className="mt-1 font-mono text-xs text-[#8BA494]">{v.channel} · verified</p>}
                      </div>
                    ))}
                  </div>
                )
              )}
              {tab === "summary" && (
                <ul className="list-disc space-y-2 pl-5 text-sm text-[#C9DCD2]">
                  {lesson.keyPoints.map((k) => <li key={k}>{k}</li>)}
                </ul>
              )}
              {tab === "notes" && (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Your notes — autosaved on this device…"
                  className="min-h-64 w-full resize-y rounded-lg border border-[#10B98122] bg-[#060D0A] p-3 text-sm outline-none placeholder:text-[#8BA49466] focus:border-[#10B981]"
                />
              )}
            </div>

            <button
              onClick={openQuiz}
              className="mt-3 rounded-lg bg-[#10B981] px-4 py-3 font-mono text-sm font-bold text-[#050A08] hover:bg-[#34D399]"
            >
              Generate Quiz →
            </button>
            <p className="mt-2 text-center font-mono text-xs text-[#8BA494]">pass at 70% to unlock the next lesson{queued ? " · 1 submission queued offline" : ""}</p>
          </aside>
        </div>
      )}

      {/* quiz modal */}
      {quizOpen && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 p-0 md:items-center md:p-6" onClick={() => !quizBusy && setQuizOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[#10B98133] bg-[#0A120E] p-5 md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Quiz — lesson {order}</h2>
              <button onClick={() => !quizBusy && setQuizOpen(false)} className="text-[#8BA494] hover:text-[#E6F4ED]">✕</button>
            </div>

            {quizBusy && !questions && <p className="animate-pulse font-mono text-sm text-[#34D399]">Generating questions… ▊</p>}
            {quizErr && (
              <div className="rounded-lg border border-[#F8717155] bg-[#F8717111] p-3 text-sm">
                <p className="text-[#F87171]">{quizErr}</p>
                <button onClick={regenQuiz} className="mt-2 rounded-lg bg-[#10B981] px-3 py-1.5 text-xs font-bold text-[#050A08]">Retry</button>
              </div>
            )}

            {questions && !grade && (
              <div className="space-y-5">
                {questions.map((q) => (
                  <div key={q.index}>
                    <p className="text-sm font-semibold">{q.index + 1}. {q.q}</p>
                    {q.type === "mcq" && q.options ? (
                      <div className="mt-2 space-y-1.5">
                        {q.options.map((o, oi) => (
                          <label key={oi} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${answers[q.index] === oi ? "border-[#10B981] bg-[#10B98118]" : "border-[#10B98122]"}`}>
                            <input
                              type="radio"
                              name={`q-${q.index}`}
                              checked={answers[q.index] === oi}
                              onChange={() => setAnswers((a) => ({ ...a, [q.index]: oi }))}
                              className="accent-[#10B981]"
                            />
                            {o}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input
                        value={(answers[q.index] as string) ?? ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.index]: e.target.value }))}
                        placeholder="Exact expected output…"
                        className="mt-2 w-full rounded-lg border border-[#10B98133] bg-[#060D0A] px-3 py-2 font-mono text-sm outline-none focus:border-[#10B981]"
                      />
                    )}
                  </div>
                ))}
                <button
                  onClick={submitQuiz}
                  disabled={quizBusy || questions.some((q) => answers[q.index] === undefined)}
                  className="w-full rounded-lg bg-[#10B981] px-4 py-2.5 font-mono text-sm font-bold text-[#050A08] disabled:opacity-40 hover:bg-[#34D399]"
                >
                  {quizBusy ? "Grading…" : "Submit Quiz"}
                </button>
              </div>
            )}

            {grade && (
              <div>
                <div className={`rounded-lg p-4 text-center ${grade.pass ? "bg-[#10B98122]" : "bg-[#FBBF2422]"}`}>
                  <p className="font-display text-3xl font-bold">{grade.score}%</p>
                  <p className="mt-1 text-sm">{grade.pass ? "Passed — next lesson unlocked ✓" : `Weak spot flagged — ${grade.correct}/${grade.total} correct. Review and retry.`}</p>
                  {grade.weak && <p className="mt-1 font-mono text-xs text-[#FBBF24]">weak badge added · tutor nudge ready</p>}
                </div>
                <div className="mt-4 space-y-3">
                  {grade.results.map((r) => (
                    <div key={r.index} className={`rounded-lg border p-3 text-sm ${r.correct ? "border-[#10B98133]" : "border-[#F8717155]"}`}>
                      <p className={r.correct ? "text-[#34D399]" : "text-[#F87171]"}>Q{r.index + 1} — {r.correct ? "correct" : "missed"}</p>
                      <p className="mt-1 text-[#8BA494]">{r.explanation}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  {grade.pass && grade.unlockedNext !== null ? (
                    <Link href={`/app/lesson/${id}/${grade.unlockedNext}`} className="flex-1 rounded-lg bg-[#10B981] px-4 py-2.5 text-center text-sm font-bold text-[#050A08]">
                      Next Lesson →
                    </Link>
                  ) : !grade.pass ? (
                    <button onClick={regenQuiz} className="flex-1 rounded-lg bg-[#10B981] px-4 py-2.5 text-sm font-bold text-[#050A08]">
                      New Quiz, Retry
                    </button>
                  ) : null}
                  <Link href={`/app/roadmap/${id}`} className="flex-1 rounded-lg border border-[#10B98133] px-4 py-2.5 text-center text-sm">
                    Back to Path
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
