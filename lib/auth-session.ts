"use client"

// Simple session management for preview environment
// In production, this would be replaced with actual Supabase auth

const SESSION_KEY = "planck_user_session"
const SESSION_EXPIRY = 30 * 24 * 60 * 60 * 1000 // 30 days

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

export function createSession(): void {
  if (typeof window === "undefined") return

  const sessionData = {
    timestamp: Date.now(),
    device: navigator.userAgent,
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData))
}

export function clearSession(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(SESSION_KEY)
}
