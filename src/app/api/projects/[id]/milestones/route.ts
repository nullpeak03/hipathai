import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabase/server"

async function getOwnedProject(id: string) {
  const { userId } = await auth()
  if (!userId) return null
  const supabase = createAdminClient()
  const { data: profile } = await supabase.from("profiles").select("id").eq("clerk_id", userId).single()
  if (!profile) return null
  const { data: project } = await supabase.from("projects").select("id").eq("id", id).eq("user_id", profile.id).single()
  return project ? supabase : null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await getOwnedProject(id)
    if (!supabase) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    const body = await request.json()
    const title = typeof body.title === "string" ? body.title.trim() : ""
    if (!title || title.length > 160) return NextResponse.json({ error: "A milestone title is required." }, { status: 400 })
    const { data, error } = await supabase.from("project_milestones").insert({
      project_id: id,
      title,
      order_index: typeof body.orderIndex === "number" ? body.orderIndex : 0,
    }).select().single()
    if (error) throw error
    return NextResponse.json({ milestone: data }, { status: 201 })
  } catch (error) {
    console.error("Milestone POST failed:", error)
    return NextResponse.json({ error: "Unable to create milestone" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await getOwnedProject(id)
    if (!supabase) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    const body = await request.json()
    if (typeof body.milestoneId !== "string" || typeof body.completed !== "boolean") return NextResponse.json({ error: "Invalid milestone update." }, { status: 400 })
    const { data, error } = await supabase.from("project_milestones").update({ completed: body.completed }).eq("id", body.milestoneId).eq("project_id", id).select().single()
    if (error) throw error
    return NextResponse.json({ milestone: data })
  } catch (error) {
    console.error("Milestone PATCH failed:", error)
    return NextResponse.json({ error: "Unable to update milestone" }, { status: 500 })
  }
}
