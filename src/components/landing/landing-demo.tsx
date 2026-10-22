"use client"
import { useEffect } from "react"
import Link from "next/link"
import { LandingHeaderAuth, LandingHeroAuth, LandingCTAAuth, LandingMobileMenu } from "@/components/landing/LandingAuth"
import "./landing-demo.css"

export function LandingDemo() {
  useEffect(() => {
    const COL = { done: "#19a974", now: "#6c5bff", lock: "var(--pale)" }
    const N: [string, number, number, string][] = [
      ["Basics", 0, 130, "done"],
      ["Loops", 112, 60, "done"],
      ["Functions", 224, 140, "now"],
      ["Classes", 336, 60, "lock"],
      ["Project", 448, 130, "lock"],
    ]
    const sc = document.getElementById("sc")
    function star() {
      return '<svg class="clay" width="46" height="46" viewBox="0 0 100 100"><path d="M50 8l11 27 29 3-22 19 7 29-25-15-25 15 7-29L10 38l29-3z" fill="url(#gA)" stroke="url(#gA)" stroke-width="8" stroke-linejoin="round"/></svg>'
    }
    function obj(i: number, s: string) {
      if (i === 0) return '<svg class="clay" width="58" height="58" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="url(#gV)"/><circle cx="50" cy="50" r="30" fill="url(#gW)"/><g style="transform-origin:50px 50px;animation:sw 3s ease-in-out infinite"><polygon points="50,18 58,50 42,50" fill="url(#gA)"/><polygon points="50,82 58,50 42,50" fill="#a69bff"/></g></svg><style>@keyframes sw{50%{transform:rotate(40deg)}}</style>'
      if (s === "now") return '<div class="bob">' + star() + "</div>"
      if (i === 3 && s === "lock") return '<svg class="clay" width="44" height="44" viewBox="0 0 100 100"><path d="M33 48V34a17 17 0 0134 0v14" fill="none" stroke="#9fa3d0" stroke-width="11" stroke-linecap="round"/><rect x="18" y="46" width="64" height="44" rx="15" fill="#8d91c8"/></svg>'
      if (i === 4) return '<svg class="clay" width="52" height="60" viewBox="0 0 100 100"><rect x="30" y="8" width="8" height="84" rx="3" fill="#cfd3f2"/><path d="M38 12l48 14-48 18z" fill="' + (s === "done" ? "#19a974" : "#a69bff") + '"/></svg>'
      return '<svg class="clay" width="44" height="44" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="url(#gG)"/><path d="M30 52l14 14 26-28" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    }
    function draw() {
      if (!sc) return
      let h = ""
      N.forEach(([n, x, y, s], i) => {
        const L = Array.from({ length: 7 }, (_, k) => `<div class="ly" style="--c:${COL[s as keyof typeof COL]};transform:translateZ(${k * 3}px);filter:brightness(${0.62 + k * 0.06})"></div>`).join("")
        h += `<div class="st" style="left:${x}px;top:${y}px"><div class="shadow"></div>${L}${s === "now" ? '<div class="glow" style="transform:translateZ(1px)"></div>' : ""}</div>`
        h += `<div class="bb" style="left:${x + 46}px;top:${y + 46}px;--h:22px"><div>${obj(i, s)}<span class="lab">${n}</span></div></div>`
      })
      sc.innerHTML = h
    }
    draw()
    const adv = document.getElementById("adv")
    if (adv) {
      adv.onclick = () => {
        const k = N.findIndex((n) => n[3] === "now")
        if (k < 0) {
          N.forEach((n, i) => (n[3] = i < 2 ? "done" : i === 2 ? "now" : "lock"))
          adv.textContent = "Pass the Functions quiz"
        } else {
          N[k][3] = "done"
          if (N[k + 1]) N[k + 1][3] = "now"
          adv.textContent = N[k + 1] ? `Pass the ${N[k + 1][0]} quiz` : "Start over"
        }
        draw()
      }
    }
    const stage = document.getElementById("stage")
    if (stage && sc) {
      stage.onmousemove = (e) => {
        const r = stage.getBoundingClientRect()
        const dx = (e.clientX - r.left) / r.width - 0.5
        const dy = (e.clientY - r.top) / r.height - 0.5
        sc.style.transform = `rotateX(${55 - dy * 8}deg) rotateZ(${-35 + dx * 8}deg) scale(.95)`
      }
      stage.onmouseleave = () => {
        sc.style.transform = ""
      }
    }
    const wk = document.getElementById("wk")
    if (wk) wk.innerHTML = "MTWTFSS".split("").map((d, i) => `<div class="dy ${i < 6 ? "on" : ""}">${d}</div>`).join("")
    const lk = document.getElementById("lk")
    if (lk) {
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) lk.classList.add("open")
      }, { threshold: 0.6 })
      io.observe(lk)
      const rp = document.getElementById("rp")
      if (rp) rp.onclick = () => {
        lk.classList.remove("open")
        void lk.offsetWidth
        setTimeout(() => lk.classList.add("open"), 500)
      }
    }
    const dots = [...document.querySelectorAll(".rail i")]
    const secs = ["s0", "s1", "s2", "s3", "s4"].map((i) => document.getElementById(i))
    function rail() {
      let c = 0
      secs.forEach((s, i) => {
        if (s && s.getBoundingClientRect().top < window.innerHeight * 0.5) c = i
      })
      dots.forEach((d, i) => {
        d.className = i < c ? "p" : i === c ? "n" : ""
      })
    }
    window.addEventListener("scroll", rail, { passive: true })
    rail()
    return () => window.removeEventListener("scroll", rail)
  }, [])

  return (
    <div className="ld-root" data-theme="dark">
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <radialGradient id="gV" cx=".3" cy=".25" r=".9"><stop offset="0" stopColor="#a69bff" /><stop offset=".55" stopColor="#6c5bff" /><stop offset="1" stopColor="#4a3bd6" /></radialGradient>
          <radialGradient id="gG" cx=".3" cy=".25" r=".9"><stop offset="0" stopColor="#5fe0ae" /><stop offset=".55" stopColor="#19a974" /><stop offset="1" stopColor="#107a55" /></radialGradient>
          <radialGradient id="gA" cx=".3" cy=".25" r=".9"><stop offset="0" stopColor="#ffd08a" /><stop offset=".55" stopColor="#ff9d2e" /><stop offset="1" stopColor="#e07a0a" /></radialGradient>
          <radialGradient id="gW" cx=".3" cy=".25" r=".9"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#cfd3f2" /></radialGradient>
        </defs>
      </svg>
      <div className="rail" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <div className="w">
        <header className="h-16 border-b border-border flex items-center justify-between px-4 sm:px-6 max-w-7xl mx-auto w-full sticky top-0 bg-card/80 backdrop-blur z-20">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold transition-transform duration-200 group-hover:scale-110 group-hover:shadow-md">H</div><span className="font-bold">HiPath AI</span></Link>
            <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#s1" className="relative py-1 hover:text-foreground transition-colors">How you learn</a>
              <a href="#s3" className="relative py-1 hover:text-foreground transition-colors">Mentor</a>
              <a href="#faq" className="relative py-1 hover:text-foreground transition-colors">FAQ</a>
              <Link href="/roadmaps" className="relative py-1 hover:text-foreground transition-colors">Library</Link>
              <Link href="/privacy" className="relative py-1 hover:text-foreground transition-colors">Privacy</Link>
            </nav>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <LandingHeaderAuth />
          </div>
          <LandingMobileMenu />
        </header>

        <header className="hero" id="s0">
          <div>
            <h1>Tell it your goal. <em>Walk the path</em> it builds.</h1>
            <p className="s">HiPath AI turns any computer science goal into a week-by-week roadmap, teaches each lesson, and unlocks the next one only when you pass the quiz.</p>
            <div className="row">
              <LandingHeroAuth />
              <a className="btn g" href="#learn">See a lesson</a>
            </div>
            <div className="chk"><span>No credit card</span><span>Free in V1</span><span>Edit anytime</span></div>
          </div>
          <div className="stage3" id="stage">
            <div className="sc" id="sc"></div>
            <div className="ctl"><button className="btn g" id="adv">Pass the Functions quiz</button></div>
          </div>
        </header>

        <section id="s1">
          <div className="eye">How you learn</div>
          <h2>Four steps on every lesson</h2>
          <p className="sub">Each step builds on the last, so you can’t skip ahead.</p>
          <div className="g4">
            <div className="cd"><svg className="o clay" viewBox="0 0 100 100"><rect x="14" y="30" width="72" height="52" rx="10" fill="url(#gV)" /><path d="M50 28c-12-8-28-8-38-4v52c10-4 26-4 38 4z" fill="url(#gW)" /><path d="M50 28c12-8 28-8 38-4v52c-10-4-26-4-38 4z" fill="url(#gW)" opacity=".85" /><rect x="62" y="18" width="9" height="22" rx="3" fill="url(#gA)" /></svg><small>Step 1</small><h3>Teach</h3><p>One idea, explained at your level.</p></div>
            <div className="cd"><svg className="o clay" viewBox="0 0 100 100"><polygon points="50,10 88,30 50,50 12,30" fill="#a69bff" stroke="#a69bff" strokeWidth="4" stroke-linejoin="round" /><polygon points="12,30 50,50 50,92 12,72" fill="#6c5bff" stroke="#6c5bff" strokeWidth="4" stroke-linejoin="round" /><polygon points="50,50 88,30 88,72 50,92" fill="#4a3bd6" stroke="#4a3bd6" strokeWidth="4" stroke-linejoin="round" /><text x="22" y="72" fill="#fff" fontFamily="monospace" fontWeight="700" fontSize="18" transform="rotate(26 22 72)">{ }</text></svg><small>Step 2</small><h3>Example</h3><p>See it run before you write any.</p></div>
            <div className="cd"><svg className="o clay" viewBox="0 0 100 100"><rect x="14" y="14" width="72" height="72" rx="22" fill="url(#gG)" /><path d="M33 52l12 12 22-26" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" /></svg><small>Step 3</small><h3>Practice</h3><p>Exercises aimed at what you missed.</p></div>
            <div className="cd"><svg className="o clay" viewBox="0 0 100 100"><rect x="14" y="14" width="72" height="72" rx="22" fill="url(#gW)" /><text x="50" y="68" textAnchor="middle" fontFamily="Bricolage Grotesque,sans-serif" fontWeight="800" fontSize="52" fill="#6c5bff">?</text></svg><small>Step 4</small><h3>Quiz</h3><p>Score 60% or more to unlock the next lesson.</p></div>
          </div>
        </section>

        <section id="s2">
          <div className="two">
            <div>
              <div className="eye">Unlock mechanic</div>
              <h2>Pass the quiz, unlock the next lesson</h2>
              <p className="sub">Score 60% or more to move on. Every finished lesson earns 20 XP.</p>
              <button className="btn g" id="rp">Replay</button>
            </div>
            <div className="box" id="lk">
              <span className="pop">+20 XP</span>
              <svg viewBox="0 0 100 100" width="200" height="200" className="clay" role="img" aria-label="Padlock opening">
                <g className="sh"><path d="M33 48V34a17 17 0 0134 0v14" fill="none" stroke="#cfd3f2" strokeWidth="11" strokeLinecap="round" /></g>
                <rect x="18" y="46" width="64" height="44" rx="15" fill="url(#gV)" />
                <circle cx="50" cy="66" r="6" fill="#e4e0ff" />
                <rect x="48" y="68" width="4" height="10" rx="2" fill="#e4e0ff" />
                <g className="tick"><circle cx="82" cy="46" r="15" fill="url(#gG)" /><path d="M75 46l5 5 9-10" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></g>
              </svg>
            </div>
          </div>
        </section>

        <section id="s3">
          <div className="two">
            <div>
              <div className="eye">Meet your mentor</div>
              <h2>A tutor that remembers where you got stuck</h2>
              <p className="sub">It sees your roadmap, your lesson, and the questions you missed, then picks practice to match.</p>
              <div className="strk"><svg className="clay bob" width="56" height="56" viewBox="0 0 100 100"><path d="M50 6c4 20 28 28 28 56a28 28 0 01-56 0c0-14 8-22 14-30 2 10 8 14 12 14-4-14-2-26 2-40z" fill="url(#gA)" /><path d="M50 52c3 10 12 14 12 24a12 12 0 01-24 0c0-6 4-9 6-12 1 4 3 6 6 6z" fill="#ffe3b8" /></svg>6-day streak</div>
              <div className="wk" id="wk"></div>
              <span className="tag">142 min this week</span>
            </div>
            <div>
              <svg className="clay bob" width="110" height="96" viewBox="0 0 110 96" style={{ display: "block", marginBottom: 6 }}>
                <path d="M20 8h70a14 14 0 0114 14v32a14 14 0 01-14 14H50L28 90V68h-8A14 14 0 016 54V22A14 14 0 0120 8z" fill="url(#gW)" />
                <circle cx="35" cy="38" r="6" fill="#6c5bff" />
                <circle cx="55" cy="38" r="6" fill="#6c5bff" />
                <circle cx="75" cy="38" r="6" fill="#6c5bff" />
              </svg>
              <div className="bub me">Why did I fail the closures quiz?</div>
              <div className="bub ai">You mixed up scope and lifetime. Try the analogy in lesson 3, then retry the quiz.<br /><span className="tag">Closures · missed 2 times</span><span className="tag">Review due</span></div>
            </div>
          </div>
        </section>

        <section id="s4">
          <div className="eye">Inside the app</div>
          <h2>Everything in one calm place</h2>
          <p className="sub">Your day, your roadmap, your tutor, and your numbers.</p>
          <div className="apps">
            <div className="ap"><h3>Today</h3><div><b>60m</b> studied</div><div><b>3</b> lessons · 4-day streak</div><div>Next: String Essentials</div></div>
            <div className="ap"><h3>Roadmap</h3><div>Week 1 · 3 of 7 done</div><div style={{ opacity: 0.6 }}>Week 2 · locked</div><div style={{ opacity: 0.6 }}>Week 3 · locked</div></div>
            <div className="ap"><h3>Tutor</h3><div>What does the f in print(f&quot;…&quot;) do?</div><div style={{ border: "1px solid #6c5bff" }}>It fills {} with values.</div></div>
            <div className="ap"><h3>Analytics</h3><div><b>Lv.1</b> · 91 XP</div><div><b>100%</b> pass rate</div><div>91 / 100 XP to Level 2</div></div>
          </div>
        </section>

        <section>
          <div className="eye">Who it is for</div>
          <h2>Built for people starting from zero</h2>
          <div className="c3" style={{ marginTop: 32 }}>
            <div className="cd"><div className="mini"></div><h3>Complete beginners</h3><p>Plain explanations and runnable examples, one step at a time.</p></div>
            <div className="cd"><div className="mini" style={{ background: "var(--ok)", boxShadow: "0 5px 0 #107a55,0 12px 14px -6px rgba(0,60,40,.4)" }}></div><h3>Students</h3><p>Fill the gaps your classes skip, at a pace that fits.</p></div>
            <div className="cd"><div className="mini" style={{ background: "var(--sun)", boxShadow: "0 5px 0 #e07a0a,0 12px 14px -6px rgba(120,60,0,.4)" }}></div><h3>Career-switchers</h3><p>A clear plan from basics to projects in short sessions.</p></div>
          </div>
        </section>

        <section id="faq">
          <div className="eye">FAQ</div>
          <h2>Questions, answered</h2>
          <div style={{ marginTop: 28, maxWidth: 780 }}>
            <details><summary>Is it really free?</summary><p>Yes. The first version is free and needs no credit card.</p></details>
            <details><summary>What can I learn?</summary><p>Anything in computer science and technology, such as Python, web development, AI agents, and data structures.</p></details>
            <details><summary>How does unlocking work?</summary><p>Score 60% or more on a lesson’s quiz to unlock the next one. You can ask for a fresh quiz anytime.</p></details>
            <details><summary>Can I change my roadmap?</summary><p>Yes. Edit reopens setup with your answers so you can change the goal, level, or schedule.</p></details>
            <details><summary>Do I need experience?</summary><p>No. Beginners get plain-language explanations. Advanced learners get edge cases and trade-offs.</p></details>
          </div>
        </section>

        <section id="cta">
          <div className="cta">
            <svg className="o clay bob" style={{ left: "6%", top: "18%" }} viewBox="0 0 100 100"><rect x="30" y="10" width="7" height="82" rx="3" fill="#cfd3f2" /><path d="M37 14l46 14-46 16z" fill="url(#gA)" /></svg>
            <svg className="o clay bob" style={{ right: "6%", bottom: "14%", animationDelay: "-1.4s" }} viewBox="0 0 100 100"><path d="M50 8l11 27 29 3-22 19 7 29-25-15-25 15 7-29L10 38l29-3z" fill="url(#gA)" stroke="url(#gA)" strokeWidth="8" strokeLinejoin="round" /></svg>
            <h2>Your first lesson is five minutes away</h2>
            <LandingCTAAuth />
          </div>
        </section>

        <footer className="border-t border-border py-8 bg-card">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-6 text-sm">
            <div>
              <div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">H</div><span className="font-semibold">HiPath AI</span></div>
              <p className="text-muted-foreground mt-2 max-w-xs">Your Personal AI Learning Navigator — CS & Technology focus. Flexible, adaptive, mentor-driven.</p>
            </div>
            <div className="flex flex-col md:items-end gap-4">
              <div className="flex gap-12">
                <div className="space-y-2">
                  <div className="font-medium">Product</div>
                  <div className="flex flex-col gap-1 text-muted-foreground">
                    <a href="#learn" className="hover:text-foreground transition-colors w-fit">How you learn</a>
                    <a href="#faq" className="hover:text-foreground transition-colors w-fit">FAQ</a>
                    <Link href="/roadmaps" className="hover:text-foreground transition-colors w-fit">Roadmap Library</Link>
                    <Link href="/guides" className="hover:text-foreground transition-colors w-fit">Guides</Link>
                    <Link href="/changelog" className="hover:text-foreground transition-colors w-fit">Changelog</Link>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="font-medium">Legal</div>
                  <div className="flex flex-col gap-1 text-muted-foreground">
                    <Link href="/privacy" className="hover:text-foreground transition-colors w-fit">Privacy</Link>
                    <Link href="/terms" className="hover:text-foreground transition-colors w-fit">Terms</Link>
                    <Link href="/cookies" className="hover:text-foreground transition-colors w-fit">Cookies</Link>
                    <Link href="/contact" className="hover:text-foreground transition-colors w-fit">Contact</Link>
                  </div>
                </div>
              </div>
              <span className="text-muted-foreground">© 2026 HiPath AI</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
