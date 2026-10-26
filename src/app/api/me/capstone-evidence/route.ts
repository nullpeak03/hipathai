import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { isAllowedEvidenceUrl, isCapstoneTitle } from "@/lib/capstone-evidence"

async function validateOwnerAndCapstone(
  roadmapId: string,
  lessonId: string,
  userId: string
) {
  const supabase = createServerClient()
  const { data: roadmap, error: roadmapError } = await supabase
    .from("roadmaps")
    .select("id")
    .eq("id", roadmapId)
    .eq("user_id", userId)
    .maybeSingle()
  if (roadmapError) return { supabase, response: NextResponse.json({ error: "Could not verify roadmap ownership" }, { status: 500 }) }
  if (!roadmap) return { supabase, response: NextResponse.json({ error: "Roadmap not found" }, { status: 404 }) }

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id,title")
    .eq("id", lessonId)
    .eq("roadmap_id", roadmapId)
    .maybeSingle()
  if (lessonError) return { supabase, response: NextResponse.json({ error: "Could not verify capstone lesson" }, { status: 500 }) }
  if (!lesson || !isCapstoneTitle(lesson.title)) {
    return { supabase, response: NextResponse.json({ error: "Capstone lesson not found" }, { status: 404 }) }
  }
  return { supabase, response: null }
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roadmapId = req.nextUrl.searchParams.get("roadmapId")
  const lessonId = req.nextUrl.searchParams.get("lessonId")
  if (!roadmapId && !lessonId) {
    const supabase = createServerClient()
    const { data: evidence, error } = await supabase
      .from("capstone_evidence")
      .select("id,roadmap_id,lesson_id,project_summary,repository_url,deployment_url,implementation_complete,validation_complete,documentation_complete,reflection,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
    if (error) return NextResponse.json({ error: "Failed to load capstone evidence" }, { status: 500 })
    return NextResponse.json({ evidence: evidence ?? [] })
  }
  if (!roadmapId || !lessonId) return NextResponse.json({ error: "Missing roadmapId or lessonId" }, { status: 400 })
  const { supabase, response } = await validateOwnerAndCapstone(roadmapId, lessonId, userId)
  if (response) return response

  const { data: evidence, error } = await supabase
    .from("capstone_evidence")
    .select("id,roadmap_id,lesson_id,project_summary,repository_url,deployment_url,implementation_complete,validation_complete,documentation_complete,reflection,updated_at")
    .eq("user_id", userId)
    .eq("roadmap_id", roadmapId)
    .eq("lesson_id", lessonId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: "Failed to load capstone evidence" }, { status: 500 })
  return NextResponse.json({ evidence: evidence ?? null })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid capstone evidence" }, { status: 400 })
  }
  const { roadmapId, lessonId } = body
  if (typeof roadmapId !== "string" || typeof lessonId !== "string") {
    return NextResponse.json({ error: "Missing roadmapId or lessonId" }, { status: 400 })
  }

  const textFields = [
    ["projectSummary", 5000],
    ["reflection", 2000],
  ] as const
  const normalizedText: Record<string, string> = {}
  for (const [key, maxLength] of textFields) {
    const value = body[key]
    if (typeof value !== "string" || value.length > maxLength) {
      return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 })
    }
    normalizedText[key] = value.trim()
  }

  const urlFields = [
    ["repositoryUrl", "repository_url"],
    ["deploymentUrl", "deployment_url"],
  ] as const
  const normalizedUrls: Record<string, string | null> = {}
  for (const [key, column] of urlFields) {
    const value = body[key]
    if (typeof value !== "string" || !isAllowedEvidenceUrl(value)) {
      return NextResponse.json({ error: `Invalid ${key}; use an HTTP or HTTPS URL` }, { status: 400 })
    }
    normalizedUrls[column] = value.trim() || null
  }

  const rubricFields = [
    ["implementationComplete", "implementation_complete"],
    ["validationComplete", "validation_complete"],
    ["documentationComplete", "documentation_complete"],
  ] as const
  const rubric: Record<string, boolean> = {}
  for (const [key, column] of rubricFields) {
    if (typeof body[key] !== "boolean") return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 })
    rubric[column] = body[key]
  }

  if (
    !normalizedText.projectSummary
    && !normalizedText.reflection
    && !normalizedUrls.repository_url
    && !normalizedUrls.deployment_url
    && !Object.values(rubric).some(Boolean)
  ) {
    return NextResponse.json({ error: "Add at least one item before saving evidence" }, { status: 400 })
  }

  const { supabase, response } = await validateOwnerAndCapstone(roadmapId, lessonId, userId)
  if (response) return response
  const { data: evidence, error } = await supabase.from("capstone_evidence").upsert({
    user_id: userId,
    roadmap_id: roadmapId,
    lesson_id: lessonId,
    project_summary: normalizedText.projectSummary,
    repository_url: normalizedUrls.repository_url,
    deployment_url: normalizedUrls.deployment_url,
    implementation_complete: rubric.implementation_complete,
    validation_complete: rubric.validation_complete,
    documentation_complete: rubric.documentation_complete,
    reflection: normalizedText.reflection,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,lesson_id" })
    .select("id,roadmap_id,lesson_id,project_summary,repository_url,deployment_url,implementation_complete,validation_complete,documentation_complete,reflection,updated_at")
    .single()
  if (error || !evidence) return NextResponse.json({ error: "Failed to save capstone evidence" }, { status: 500 })
  return NextResponse.json({ ok: true, evidence })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roadmapId = req.nextUrl.searchParams.get("roadmapId")
  const lessonId = req.nextUrl.searchParams.get("lessonId")
  if (!roadmapId || !lessonId) return NextResponse.json({ error: "Missing roadmapId or lessonId" }, { status: 400 })
  const { supabase, response } = await validateOwnerAndCapstone(roadmapId, lessonId, userId)
  if (response) return response
  const { error } = await supabase.from("capstone_evidence")
    .delete()
    .eq("user_id", userId)
    .eq("roadmap_id", roadmapId)
    .eq("lesson_id", lessonId)
  if (error) return NextResponse.json({ error: "Failed to remove capstone evidence" }, { status: 500 })
  return NextResponse.json({ ok: true })
}
