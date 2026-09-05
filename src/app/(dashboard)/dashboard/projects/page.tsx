"use client"

import { useEffect, useState } from "react"
import { BriefcaseBusiness, CalendarDays, CheckCircle2, Circle, Plus, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DashboardEmptyState, DashboardPageHeader, DashboardSurface } from "@/components/dashboard/dashboard-ui"

type Milestone = { id: string; title: string; completed: boolean }
type Project = { id: string; title: string; description: string; status: string; color: string; target_date: string | null; progress: number; project_milestones: Milestone[] }

const tones: Record<string, string> = {
  violet: "from-violet-500/25 to-violet-500/5",
  cyan: "from-cyan-400/25 to-cyan-400/5",
  amber: "from-amber-400/25 to-amber-400/5",
  rose: "from-rose-400/25 to-rose-400/5",
}
const colorDots: Record<string, string> = {
  violet: "bg-violet-400",
  cyan: "bg-cyan-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: "", description: "", targetDate: "", color: "violet" })

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/projects")
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setProjects(result.projects || [])
    } catch (error) {
      console.error("Failed to load projects:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const createProject = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) return
    setCreating(true)
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setProjects((current) => [result.project, ...current])
      setForm({ title: "", description: "", targetDate: "", color: "violet" })
    } catch (error) {
      console.error("Failed to create project:", error)
    } finally {
      setCreating(false)
    }
  }

  const removeProject = async (id: string) => {
    if (!window.confirm("Delete this project?")) return
    const response = await fetch(`/api/projects/${id}`, { method: "DELETE" })
    if (response.ok) setProjects((current) => current.filter((project) => project.id !== id))
  }

  const addMilestone = async (projectId: string, title: string) => {
    if (!title.trim()) return
    const response = await fetch(`/api/projects/${projectId}/milestones`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) })
    const result = await response.json()
    if (!response.ok) return
    setProjects((current) => current.map((project) => project.id === projectId ? { ...project, project_milestones: [...(project.project_milestones || []), result.milestone] } : project))
  }

  const toggleMilestone = async (project: Project, milestone: Milestone) => {
    const completed = !milestone.completed
    const response = await fetch(`/api/projects/${project.id}/milestones`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ milestoneId: milestone.id, completed }) })
    if (!response.ok) return
    const milestones = project.project_milestones.map((item) => item.id === milestone.id ? { ...item, completed } : item)
    const progress = milestones.length ? Math.round((milestones.filter((item) => item.completed).length / milestones.length) * 100) : project.progress
    setProjects((current) => current.map((item) => item.id === project.id ? { ...item, project_milestones: milestones, progress } : item))
  }

  return (
    <div className="space-y-8">
      <DashboardPageHeader eyebrow="Personal workspace" title="Projects that move you forward" description="Turn your learning goals into focused, measurable workstreams with milestones that stay connected to your adaptive path." actions={<Button onClick={() => document.getElementById("create-project")?.scrollIntoView({ behavior: "smooth" })} className="gap-2 bg-white text-slate-950 hover:bg-cyan-100"><Plus className="h-4 w-4" /> New project</Button>} />
      {loading ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <DashboardSurface key={item} className="h-56 animate-pulse"><div className="h-5 w-2/3 rounded bg-white/10" /><div className="mt-5 h-3 w-full rounded bg-white/10" /></DashboardSurface>)}</div> : projects.length === 0 ? <DashboardEmptyState icon={BriefcaseBusiness} title="Your project board is clear" description="Create a project for a portfolio build, certification sprint, or any outcome you want your roadmap to support." action={<Button onClick={() => document.getElementById("create-project")?.scrollIntoView({ behavior: "smooth" })}><Plus className="mr-2 h-4 w-4" /> Create your first project</Button>} /> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => {
        const milestones = project.project_milestones || []
        const completed = milestones.filter((milestone) => milestone.completed).length
        return <DashboardSurface key={project.id} className={`group relative overflow-hidden bg-gradient-to-br ${tones[project.color] || tones.violet}`}>
          <div className="flex items-start justify-between gap-3"><div className="rounded-2xl border border-white/10 bg-black/10 p-3"><Sparkles className="h-5 w-5 text-cyan-200" /></div><button onClick={() => removeProject(project.id)} aria-label={`Delete ${project.title}`} className="rounded-xl p-2 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-rose-400/10 hover:text-rose-200"><Trash2 className="h-4 w-4" /></button></div>
          <h2 className="mt-5 text-xl font-semibold text-white">{project.title}</h2><p className="mt-2 min-h-10 text-sm leading-5 text-slate-400">{project.description || "A focused learning outcome."}</p>
          <div className="mt-6 flex items-center justify-between text-xs text-slate-400"><span>{project.progress}% complete</span><span>{completed}/{milestones.length || 0} milestones</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-black/20"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300" style={{ width: `${project.progress}%` }} /></div>
          {project.target_date && <p className="mt-5 flex items-center gap-2 text-xs text-slate-400"><CalendarDays className="h-3.5 w-3.5 text-cyan-200" /> Target {new Date(project.target_date).toLocaleDateString()}</p>}
          <div className="mt-5 space-y-2 border-t border-white/10 pt-4">{milestones.slice(0, 3).map((milestone) => <button key={milestone.id} onClick={() => toggleMilestone(project, milestone)} className="flex w-full items-center gap-2 text-left text-sm text-slate-300 hover:text-white">{milestone.completed ? <CheckCircle2 className="h-4 w-4 text-cyan-200" /> : <Circle className="h-4 w-4 text-slate-600" />}{milestone.title}</button>)}<form onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.namedItem("milestone") as HTMLInputElement; void addMilestone(project.id, input.value); input.value = "" }} className="flex gap-2 pt-2"><Input name="milestone" placeholder="Add milestone..." className="h-8 text-xs" /><Button type="submit" size="sm" variant="ghost" className="h-8 px-2 text-xs">Add</Button></form></div>
        </DashboardSurface>
      })}</div>}
      <DashboardSurface id="create-project" className="max-w-3xl">
        <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Start with an outcome</p><h2 className="mt-2 text-2xl font-semibold text-white">Create a project</h2><p className="mt-2 text-sm text-slate-400">Give your next learning outcome a home. You can add milestones as the plan takes shape.</p></div>
        <form onSubmit={createProject} className="grid gap-4 sm:grid-cols-2"><Input required placeholder="Project title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /><Input type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} /><Textarea className="sm:col-span-2" placeholder="What will success look like?" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><div className="flex flex-wrap gap-2 sm:col-span-2">{["violet", "cyan", "amber", "rose"].map((color) => <button type="button" key={color} onClick={() => setForm({ ...form, color })} className={`h-8 w-8 rounded-full ${colorDots[color]} ${form.color === color ? "ring-2 ring-white ring-offset-2 ring-offset-[#101828]" : "opacity-50"}`} aria-label={`${color} project color`} />)}</div><Button type="submit" disabled={creating} className="sm:col-span-2">{creating ? "Creating..." : "Create project"}</Button></form>
      </DashboardSurface>
    </div>
  )
}
