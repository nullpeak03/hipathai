import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabase/server"

async function getProfileId() {
  const { userId } = await auth()
  if (!userId) return null
  const supabase = createAdminClient()
  const { data, error } = await supabase.from("profiles").select("id").eq("clerk_id", userId).single()
  if (error) throw error
  return data?.id || null
}

export async function GET() {
  try {
    const profileId = await getProfileId()
    if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const supabase = createAdminClient()
    const { data, error } = await supabase.from("projects").select("*, project_milestones(*)").eq("user_id", profileId).order("updated_at", { ascending: false })
    if (error) throw error
    return NextResponse.json({ projects: data || [] })
  } catch (error) {
    console.error("Projects GET failed:", error)
    return NextResponse.json({ error: "Unable to load projects" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const profileId = await getProfileId()
    if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const body = await request.json()
    const title = typeof body.title === "string" ? body.title.trim() : ""
    if (!title || title.length > 120) return NextResponse.json({ error: "A project title between 1 and 120 characters is required." }, { status: 400 })
    const supabase = createAdminClient()
    const { data, error } = await supabase.from("projects").insert({
      user_id: profileId,
      title,
      description: typeof body.description === "string" ? body.description.trim().slice(0, 500) : "",
      target_date: typeof body.targetDate === "string" && body.targetDate ? body.targetDate : null,
      color: ["violet", "cyan", "amber", "rose"].includes(body.color) ? body.color : "violet",
    }).select("*, project_milestones(*)").single()
    if (error) throw error
    return NextResponse.json({ project: data }, { status: 201 })
  } catch (error) {
    console.error("Projects POST failed:", error)
    return NextResponse.json({ error: "Unable to create project" }, { status: 500 })
  }
}
