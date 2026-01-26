import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { validateApiKey } from "@/lib/security"

/**
 * Health check endpoint for the Planck API
 * Used by the SDK to verify connectivity and authentication
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key")
    
    // Basic health check without auth
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      })
    }
    
    // Authenticated health check
    if (!validateApiKey(apiKey)) {
      return NextResponse.json(
        { success: false, error: "Invalid API key format" },
        { status: 401 }
      )
    }
    
    const supabase = await createServerClient()
    
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("api_key", apiKey)
      .single()
    
    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Invalid API key" },
        { status: 401 }
      )
    }
    
    return NextResponse.json({
      success: true,
      status: "healthy",
      authenticated: true,
      user_id: profile.id,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    })
  } catch (error) {
    console.error("[API] Health check error:", error)
    return NextResponse.json({
      success: false,
      status: "unhealthy",
      error: "Service temporarily unavailable",
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const apiKey = request.headers.get("x-api-key")
    
    // Ping check for SDK
    if (body.ping) {
      if (!apiKey) {
        return NextResponse.json({
          success: true,
          pong: true,
          timestamp: new Date().toISOString(),
        })
      }
      
      // Authenticated ping
      if (!validateApiKey(apiKey)) {
        return NextResponse.json(
          { success: false, error: "Invalid API key format" },
          { status: 401 }
        )
      }
      
      const supabase = await createServerClient()
      
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("api_key", apiKey)
        .single()
      
      if (profileError || !profile) {
        return NextResponse.json(
          { success: false, error: "Invalid API key" },
          { status: 401 }
        )
      }
      
      return NextResponse.json({
        success: true,
        pong: true,
        authenticated: true,
        timestamp: new Date().toISOString(),
      })
    }
    
    return NextResponse.json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[API] Health check error:", error)
    return NextResponse.json({
      success: false,
      status: "unhealthy",
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}
