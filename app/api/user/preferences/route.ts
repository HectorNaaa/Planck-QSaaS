import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { Profiles } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (!auth.ok || !auth.userId) {
    return NextResponse.json({ hidden: [] })
  }
  const profile = Profiles.findByUserId(auth.userId)
  let hidden: string[] = []
  try {
    if (profile?.ui_preferences) {
      const parsed = JSON.parse(profile.ui_preferences)
      hidden = Array.isArray(parsed?.hidden) ? parsed.hidden : []
    }
  } catch { /* malformed JSON — return empty */ }
  return NextResponse.json({ hidden })
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (!auth.ok || !auth.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body || typeof body !== "object" || !Array.isArray((body as Record<string, unknown>).hidden)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }
  const hidden = ((body as Record<string, unknown>).hidden as unknown[])
    .filter((k): k is string => typeof k === "string")
    .slice(0, 500)
  Profiles.update(auth.userId, { ui_preferences: JSON.stringify({ hidden }) })
  return NextResponse.json({ ok: true })
}
