import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabase/server"

async function ownedProject(id: string) {
  const { userId } = await auth()
  if (!userId) return null
  const supabase = createAdminClient()
  const { data: profile } = await supabase.from("profiles").select("id").eq("clerk_id", userId).single()
  if (!profile) return null
  const { data: project } = await supabase.from("projects").select("id").eq("id", id).eq("user_id", profile.id).single()
  return project ? { profileId: profile.id, supabase } : null
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const owned = await ownedProject(id)
    if (!owned) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    const body = await request.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim().slice(0, 120)
    if (typeof body.description === "string") updates.description = body.description.trim().slice(0, 500)
    if (typeof body.progress === "number" && body.progress >= 0 && body.progress <= 100) updates.progress = Math.round(body.progress)
    if (["active", "paused", "completed", "archived"].includes(body.status)) updates.status = body.status
    const { data, error } = await owned.supabase.from("projects").update(updates).eq("id", id).select("*, project_milestones(*)").single()
    if (error) throw error
    return NextResponse.json({ project: data })
  } catch (error) {
    console.error("Project PATCH failed:", error)
    return NextResponse.json({ error: "Unable to update project" }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const owned = await ownedProject(id)
    if (!owned) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    const { error } = await owned.supabase.from("projects").delete().eq("id", id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Project DELETE failed:", error)
    return NextResponse.json({ error: "Unable to delete project" }, { status: 500 })
  }
}
