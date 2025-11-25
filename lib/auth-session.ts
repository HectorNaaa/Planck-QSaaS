"use client"

// Simple session management for preview environment
// In production, this would be replaced with actual Supabase auth

const SESSION_KEY = "planck_user_session"
const SESSION_EXPIRY = 30 * 24 * 60 * 60 * 1000 // 30 days
const IP_KEY = "planck_user_ip"

async function getUserIP(): Promise<string> {
  if (typeof window === "undefined") return "unknown"

  try {
    // Use ipify API to get user's public IP
    const response = await fetch("https://api.ipify.org?format=json")
    const data = await response.json()
    return data.ip
  } catch {
    return "unknown"
  }
}

function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "unknown"

  // Create a simple device fingerprint
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  ctx?.fillText("fingerprint", 0, 0)
  const fingerprint = canvas.toDataURL()

  return btoa(
    `${navigator.userAgent}-${navigator.language}-${screen.width}x${screen.height}-${fingerprint.slice(0, 100)}`,
  )
}

export function hasActiveSession(): boolean {
  if (typeof window === "undefined") return false

  try {
    const sessionData = localStorage.getItem(SESSION_KEY)
    if (!sessionData) return false

    const { timestamp } = JSON.parse(sessionData)
    const isExpired = Date.now() - timestamp > SESSION_EXPIRY

    if (isExpired) {
      localStorage.removeItem(SESSION_KEY)
      return false
    }

    return true
  } catch {
    return false
  }
}

export async function createSession(email?: string): Promise<void> {
  if (typeof window === "undefined") return

  const ip = await getUserIP()
  const fingerprint = getDeviceFingerprint()

  const sessionData = {
    timestamp: Date.now(),
    device: navigator.userAgent,
    ip,
    fingerprint,
    email: email || "user@planck.com",
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData))
  localStorage.setItem(IP_KEY, ip)

  // Set a cookie for additional persistence
  document.cookie = `planck_session=${fingerprint}; max-age=${SESSION_EXPIRY / 1000}; path=/; SameSite=Strict`
}

export function clearSession(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(IP_KEY)
  document.cookie = "planck_session=; max-age=0; path=/"
}

export function getSessionData(): { email: string; ip: string } | null {
  if (typeof window === "undefined") return null

  try {
    const sessionData = localStorage.getItem(SESSION_KEY)
    if (!sessionData) return null

    const { email, ip } = JSON.parse(sessionData)
    return { email, ip }
  } catch {
    return null
  }
}
