"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Save, Sun, Moon, Check, LogOut, Trash2, Edit, Copy, RefreshCw } from "lucide-react"
import { useTheme } from "next-themes"
import { PageHeader } from "@/components/page-header"
import { useRouter } from "next/navigation"
import { LanguageSelector } from "@/components/language-selector"
import { deleteUserAccount, updateUserAccount, generateApiKey, getApiKey, revokeApiKey, deleteExecutions, clearAllExecutionHistory } from "./actions"
import { useIsGuest } from "@/components/guest-banner"

// ── Execution history deletion-tracking helpers (localStorage) ────────────
// These prevent server rows from "coming back" after a user deletes them,
// even when a different Vercel lambda instance still has them in its SQLite.
const EXEC_CACHE_KEY = "planck_exec_cache"
const CLEARED_BEFORE_KEY = "planck_exec_cleared_before"
const DELETED_IDS_KEY = "planck_exec_deleted_ids"

function appendDeletedIds(ids: string[]) {
  try {
    let arr: string[] = []
    const raw = localStorage.getItem(DELETED_IDS_KEY)
    if (raw) arr = JSON.parse(raw) as string[]
    const next = Array.from(new Set([...arr, ...ids])).slice(-2000)
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(next))
  } catch { /* non-fatal */ }
}

function markHistoryCleared() {
  try {
    localStorage.setItem(CLEARED_BEFORE_KEY, new Date().toISOString())
    localStorage.removeItem(DELETED_IDS_KEY) // superseded by cleared_before
  } catch { /* non-fatal */ }
}

function applyLocalDeletedFilter<T extends { id: string; created_at: string }>(rows: T[]): T[] {
  let clearedBefore: Date | null = null
  let deletedIds = new Set<string>()
  try {
    const ts = localStorage.getItem(CLEARED_BEFORE_KEY)
    if (ts) clearedBefore = new Date(ts)
  } catch {}
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY)
    if (raw) deletedIds = new Set(JSON.parse(raw) as string[])
  } catch {}
  if (!clearedBefore && deletedIds.size === 0) return rows
  return rows.filter((r) => {
    if (deletedIds.has(r.id)) return false
    if (clearedBefore && new Date(r.created_at) <= clearedBefore) return false
    return true
  })
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [darkModeEnabled, setDarkModeEnabled] = useState(theme === "dark")
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [improveModelsEnabled, setImproveModelsEnabled] = useState(true)
  const [stayLoggedIn, setStayLoggedIn] = useState(true)
  const [userEmail, setUserEmail] = useState("")
  const [originalEmail, setOriginalEmail] = useState("")
  const [userName, setUserName] = useState("")
  const [userFirstName, setUserFirstName] = useState("")
  const [userLastName, setUserLastName] = useState("")
  const [userOrg, setUserOrg] = useState("")
  const [userCountry, setUserCountry] = useState("")
  const [userPhone, setUserPhone] = useState("")
  const [userOccupation, setUserOccupation] = useState("")
  const [isEditingAccount, setIsEditingAccount] = useState(false)
  const [isSavingAccount, setIsSavingAccount] = useState(false)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [apiKeyCreatedAt, setApiKeyCreatedAt] = useState<string | null>(null)
  const [isGeneratingKey, setIsGeneratingKey] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const isGuest = useIsGuest()

  // Execution history / storage state
  type ExecHistoryRow = { id: string; circuit_name: string; algorithm: string; status: string; created_at: string; size_bytes: number; backend_selected?: string | null; runtime_ms?: number; shots?: number; circuit_data?: any }
  const [execHistory, setExecHistory] = useState<ExecHistoryRow[]>([])
  const [execStorageUsed, setExecStorageUsed] = useState(0)
  const [execTotalRows, setExecTotalRows] = useState(0)
  const [selectedExecIds, setSelectedExecIds] = useState<Set<string>>(new Set())
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false)
  const [isClearingHistory, setIsClearingHistory] = useState(false)
  const [isDeletingExecs, setIsDeletingExecs] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  useEffect(() => {
    const loadUserData = async () => {
      let isAuthenticated = false

      try {
        // Get user data from server (JWT-verified endpoint)
        const response = await fetch("/api/request-utils", {
          method: "GET",
          credentials: "include",
        })

        if (!response.ok) {
          router.push("/auth/login")
          return
        }

        const userData = await response.json()
        if (userData && userData.user) {
          const user = userData.user
          isAuthenticated = !userData.guest
          
          setUserEmail(user.email || "")
          setOriginalEmail(user.email || "")
          setUserName(user.full_name || "")
          
          setUserFirstName(user.first_name || "")
          setUserLastName(user.last_name || "")
          
          setUserOrg(user.organization || "")
          setUserCountry(user.country || "")
          setUserPhone(user.phone || "")
          setUserOccupation(user.occupation || "")
          setStayLoggedIn(user.stay_logged_in !== false)
          setDarkModeEnabled(user.theme_preference === "dark")
        }
      } catch (error) {
        console.error("Failed to load user data:", error)
      }

      // ── Load existing API key (only for authenticated users) ──
      if (isAuthenticated) {
        try {
          const keyResult = await getApiKey()
          if (keyResult.activeKey) {
            // Real key recovered from JWT — usable for copy/paste in SDK
            setApiKey(keyResult.activeKey)
            setApiKeyCreatedAt(keyResult.keys?.[0]?.created_at || new Date().toISOString())
          } else if (keyResult.keys && keyResult.keys.length > 0) {
            // Key metadata in DB but JWT claim absent (should not happen normally)
            setApiKey("pk_••••••••••••")
            setApiKeyCreatedAt(keyResult.keys[0].created_at)
          }
        } catch (err) {
          console.warn("Failed to load API keys:", err)
        }
      }

      const stayLoggedInPref = localStorage.getItem("planck_stay_logged_in")
      setStayLoggedIn(stayLoggedInPref !== "false")
    }

    loadUserData()
  }, [router])

  const handleDarkModeToggle = async () => {
    const newMode = !darkModeEnabled
    setDarkModeEnabled(newMode)
    const newTheme = newMode ? "dark" : "light"
    setTheme(newTheme)

    // Save theme preference to database via API
    try {
      await updateUserAccount({ theme_preference: newTheme })
    } catch (error) {
      console.error("[v0] Failed to save theme preference:", error)
    }
  }

  const handleImproveModelsToggle = () => {
    setImproveModelsEnabled(!improveModelsEnabled)
  }

  const handleStayLoggedInToggle = async () => {
    const newValue = !stayLoggedIn
    setStayLoggedIn(newValue)
    localStorage.setItem("planck_stay_logged_in", String(newValue))

    try {
      await updateUserAccount({ stay_logged_in: newValue })
    } catch (error) {
      console.error("[v0] Error saving stay logged in preference:", error)
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)

    try {
      // Call logout endpoint to clear auth cookie
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })
      
      document.cookie = "planck_guest=; max-age=0; path=/"
      sessionStorage.clear()
      localStorage.removeItem("planck_stay_logged_in")
      localStorage.removeItem("planck_exec_cache")
      router.push("/auth/login")
    } catch (error) {
      console.error("Logout error:", error)
      router.push("/auth/login")
    } finally {
      setIsLoggingOut(false)
    }
  }

  // Loads execution history by merging /api/dashboard/data (server SQLite rows)
  // with planck_exec_cache (localStorage), exactly like the dashboard does.
  // This survives Vercel ephemeral SQLite cold-starts and includes SDK runs.
  const loadExecutionHistory = async () => {
    setIsLoadingHistory(true)
    try {
      // 1. Fetch server rows (same endpoint as dashboard, covers UI + SDK runs)
      let serverRows: ExecHistoryRow[] = []
      try {
        const res = await fetch("/api/dashboard/data?timeRange=30d", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          serverRows = (data.logs ?? []) as ExecHistoryRow[]
        }
      } catch { /* network error — fall back to cache only */ }

      // 2. Merge with localStorage cache (cold-start resilience + SDK cross-tab sync)
      let cachedRows: ExecHistoryRow[] = []
      try {
        const raw = localStorage.getItem(EXEC_CACHE_KEY)
        if (raw) cachedRows = JSON.parse(raw) as ExecHistoryRow[]
      } catch { /* localStorage unavailable */ }

      const serverIds = new Set(serverRows.map((r) => r.id))
      const extra = cachedRows.filter((r) => !serverIds.has(r.id))
      // Filter out rows the user explicitly deleted (guards against cross-lambda SQLite drift)
      const merged = applyLocalDeletedFilter([...serverRows, ...extra])
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      // 3. Annotate with estimated per-row storage footprint
      const annotated: ExecHistoryRow[] = merged.map((r) => ({
        ...r,
        size_bytes: JSON.stringify(r).length,
      }))

      setExecHistory(annotated)
      setExecTotalRows(annotated.length)
      setExecStorageUsed(annotated.reduce((s, r) => s + (r.size_bytes ?? 0), 0))
    } catch { /* non-fatal */ }
    finally { setIsLoadingHistory(false) }
  }

  // Trigger history load once auth is resolved (isGuest becomes stable after /api/request-utils)
  useEffect(() => {
    if (!isGuest) loadExecutionHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest])

  const handleDeleteSelected = async () => {
    const idsToDelete = Array.from(selectedExecIds)
    if (!idsToDelete.length) return
    setIsDeletingExecs(true)
    try {
      // Best-effort server delete (may be no-op if SQLite is cold-started)
      await deleteExecutions(idsToDelete).catch(() => {})
      // Persist deleted IDs so they’re filtered even if server returns them (cross-lambda)
      appendDeletedIds(idsToDelete)
      // Always remove from localStorage cache
      try {
        const cached = localStorage.getItem(EXEC_CACHE_KEY)
        if (cached) {
          const toDeleteSet = new Set(idsToDelete)
          const filtered = (JSON.parse(cached) as any[]).filter((r) => !toDeleteSet.has(r.id))
          localStorage.setItem(EXEC_CACHE_KEY, JSON.stringify(filtered))
        }
      } catch { /* non-fatal */ }
      // Update state immediately without a full reload
      const toDeleteSet = new Set(idsToDelete)
      setExecHistory((prev) => {
        const next = prev.filter((r) => !toDeleteSet.has(r.id))
        setExecTotalRows(next.length)
        setExecStorageUsed(next.reduce((s, r) => s + (r.size_bytes ?? 0), 0))
        return next
      })
      setSelectedExecIds(new Set())
    } catch (err: any) {
      alert(`Error deleting executions: ${err.message}`)
    } finally {
      setIsDeletingExecs(false)
    }
  }

  const handleClearAllHistory = async () => {
    setIsClearingHistory(true)
    try {
      const result = await clearAllExecutionHistory()
      if (result.error) throw new Error(result.error)
      // Mark all current rows as cleared so they’re filtered even if server returns them
      markHistoryCleared()
      setExecHistory([])
      setExecStorageUsed(0)
      setExecTotalRows(0)
      setSelectedExecIds(new Set())
      setShowClearHistoryConfirm(false)
      try { localStorage.removeItem(EXEC_CACHE_KEY) } catch { /* non-fatal */ }
    } catch (err: any) {
      alert(`Error clearing history: ${err.message}`)
    } finally {
      setIsClearingHistory(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (isGuest) { alert("Sign in to manage your account."); return }
    setIsDeleting(true)

    try {
      const result = await deleteUserAccount()

      if (result.error) {
        throw new Error(result.error)
      }

      localStorage.removeItem("planck_stay_logged_in")
      localStorage.clear()

      router.push("/")
    } catch (error: any) {
      console.error("Delete account error:", error)
      alert("Error deleting account. Please contact support at hello@plancktechnologies.xyz")
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleSaveAccount = async () => {
    if (isGuest) { alert("Sign in to save account settings."); return }
    setIsSavingAccount(true)
    try {
      const result = await updateUserAccount({
        email: userEmail !== originalEmail ? userEmail : undefined,
        firstName: userFirstName,
        lastName: userLastName,
        country: userCountry,
        phone: userPhone,
        occupation: userOccupation,
        org: userOrg,
      })

      if (result.error) {
        throw new Error(result.error)
      }

      const fullName = `${userFirstName} ${userLastName}`.trim()
      setUserName(fullName)
      setOriginalEmail(userEmail)
      setIsEditingAccount(false)
      alert("Account details saved successfully!")
    } catch (error: any) {
      console.error("Error saving account:", error)
      alert(`Error saving account details: ${error.message}`)
    } finally {
      setIsSavingAccount(false)
    }
  }

  const handleCopyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey)
      alert("API key copied to clipboard!")
    }
  }

  const handleGenerateApiKey = async () => {
    if (isGuest) { alert("Sign in to manage API keys."); return }
    if (apiKey) {
      const confirmed = confirm("This will revoke your existing API key. Are you sure?")
      if (!confirmed) return
    }

    setIsGeneratingKey(true)
    try {
      const result = await generateApiKey()
      if (result.error) {
        throw new Error(result.error)
      }
      setApiKey(result.apiKey!)
      setApiKeyCreatedAt(new Date().toISOString())
      alert("API key generated successfully! Copy it and use it with the Planck SDK.")
    } catch (error: any) {
      console.error("Error generating API key:", error)
      alert(`Error generating API key: ${error.message}`)
    } finally {
      setIsGeneratingKey(false)
    }
  }

  const handleRevokeApiKey = async () => {
    const confirmed = confirm("Are you sure you want to revoke your API key? This cannot be undone.")
    if (!confirmed) return

    try {
      const result = await revokeApiKey()
      if (result.error) {
        throw new Error(result.error)
      }
      setApiKey(null)
      setApiKeyCreatedAt(null)
      alert("API key revoked successfully!")
    } catch (error: any) {
      console.error("Error revoking API key:", error)
      alert(`Error revoking API key: ${error.message}`)
    }
  }

  const plans = [
    {
      name: "Starter",
      price: "€0",
      period: "/month",
      description: "For those beginning the journey",
      features: [
        "Quantum-inspired executions",
        "Up to 12 qubits",
        "Pre-built algorithms",
        "Basic analytics",
        "Community support",
      ],
      current: true,
      comingSoon: false,
    },
    {
      name: "Pro",
      price: "€49",
      period: "/month",
      description: "For professionals and teams",
      features: [
        "QPUs and quantum-inspired",
        "Up to 36 qubits",
        "Pre-built algorithms",
        "Advanced analytics",
        "Priority support",
        "Error Mitigation",
        "API access",
      ],
      current: false,
      comingSoon: true,
    },
    {
      name: "Enterprise",
      price: "Contact",
      period: "Us",
      description: "Commercial-grade solutions",
      features: [
        "QPUs and quantum-inspired",
        "Up to 36 qubits",
        "Custom use cases",
        "Custom analytics",
        "Priority support",
        "Error Mitigation",
        "API access",
        "Queue priority",
        "Team education",
      ],
      current: false,
      comingSoon: false,
    },
  ]

  return (
    <div className="p-8 space-y-4 py-4 px-0">
      {/* Version indicator */}
      <div className="flex justify-end mb-2">
        <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
          v0.9 (Beta)
        </span>
      </div>
      
      <PageHeader title="Settings" description="Manage your account and preferences." />

      {/* Account Settings */}
      <Card className="p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Account</h2>
          {!isEditingAccount ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingAccount(true)}
              className="flex items-center gap-2"
            >
              <Edit size={16} />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditingAccount(false)} disabled={isSavingAccount}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveAccount}
                disabled={isSavingAccount}
                className="bg-primary hover:bg-primary/90"
              >
                {isSavingAccount ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                First Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={userFirstName}
                onChange={(e) => setUserFirstName(e.target.value)}
                placeholder="John"
                disabled={!isEditingAccount}
                className="w-full px-4 py-2 rounded-lg border border-border bg-secondary/50 text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Last Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={userLastName}
                onChange={(e) => setUserLastName(e.target.value)}
                placeholder="Quantum"
                disabled={!isEditingAccount}
                className="w-full px-4 py-2 rounded-lg border border-border bg-secondary/50 text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Email <span className="text-destructive">*</span>
            </label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="user@example.com"
              disabled={!isEditingAccount}
              className="w-full px-4 py-2 rounded-lg border border-border bg-secondary/50 text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {isEditingAccount && userEmail !== originalEmail && (
              <p className="text-xs text-amber-500 mt-1">Note: Changing your email will require re-verification</p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Country <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={userCountry}
                onChange={(e) => setUserCountry(e.target.value)}
                placeholder="United States"
                disabled={!isEditingAccount}
                className="w-full px-4 py-2 rounded-lg border border-border bg-secondary/50 text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Phone Number <span className="text-destructive">*</span>
              </label>
              <input
                type="tel"
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                placeholder="+1234567890"
                disabled={!isEditingAccount}
                className="w-full px-4 py-2 rounded-lg border border-border bg-secondary/50 text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Organization <span className="text-xs text-muted-foreground">(Optional)</span>
              </label>
              <input
                type="text"
                value={userOrg}
                onChange={(e) => setUserOrg(e.target.value)}
                placeholder="Quantum Research Lab"
                disabled={!isEditingAccount}
                className="w-full px-4 py-2 rounded-lg border border-border bg-secondary/50 text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Occupation <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={userOccupation}
                onChange={(e) => setUserOccupation(e.target.value)}
                placeholder="Researcher"
                disabled={!isEditingAccount}
                className="w-full px-4 py-2 rounded-lg border border-border bg-secondary/50 text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-border">
          <Button
            onClick={handleSaveAccount}
            disabled={isSavingAccount}
            className="bg-primary hover:bg-primary/90 flex items-center gap-2"
          >
            <Save size={18} />
            {isSavingAccount ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </Card>

      {/* API Keys */}
      <Card className="p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6">API Keys</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Use API keys to authenticate requests to the Planck API from your Python code or Jupyter notebooks.
        </p>
        <div className="space-y-4">
          {apiKey ? (
            <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground mb-1">Production Key</p>
                <p className="text-sm text-muted-foreground font-mono truncate">{apiKey}</p>
                {apiKeyCreatedAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Created: {new Date(apiKeyCreatedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyApiKey}
                  className="flex items-center gap-2 bg-transparent"
                >
                  <Copy size={16} />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRevokeApiKey}
                  className="flex items-center gap-2 bg-transparent text-destructive hover:text-destructive"
                >
                  <Trash2 size={16} />
                  Revoke
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-secondary/50 rounded-lg border border-border text-center">
              <p className="text-muted-foreground mb-4">No API key generated yet.</p>
              <Button
                onClick={handleGenerateApiKey}
                disabled={isGeneratingKey}
                className="bg-primary hover:bg-primary/90 flex items-center gap-2 mx-auto"
              >
                <RefreshCw size={16} />
                {isGeneratingKey ? "Generating..." : "Generate API Key"}
              </Button>
            </div>
          )}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-2">SDK Installation</p>
            <code className="text-xs bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded text-blue-900 dark:text-blue-100">
              pip install planck-sdk
            </code>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
              Check the{" "}
              <a
                href="https://github.com/HectorNaaa/Planck-QSaaS/tree/main/sdk/python"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                SDK documentation
              </a>{" "}
              for examples.
            </p>
          </div>
        </div>
      </Card>

      {/* Execution History & Storage */}
      <Card className="p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-2">Execution History &amp; Storage</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Manage your saved quantum execution history. Usage is measured against a 50 MB cap.
        </p>

        {/* Storage progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Storage used</span>
            <span className="font-medium text-foreground">
              {(execStorageUsed / 1_048_576).toFixed(2)} MB / 50 MB
              <span className="text-muted-foreground ml-2">
                ({Math.min(100, (execStorageUsed / (50 * 1_048_576)) * 100).toFixed(1)}%)
              </span>
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2.5">
            <div
              className="bg-primary rounded-full h-2.5 transition-all duration-300"
              style={{ width: `${Math.min(100, (execStorageUsed / (50 * 1_048_576)) * 100).toFixed(2)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {execTotalRows} execution{execTotalRows !== 1 ? "s" : ""} stored
          </p>
        </div>

        {/* History table */}
        {isLoadingHistory ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading history…</p>
        ) : execHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No saved execution history.</p>
        ) : (
          <div className="overflow-x-auto max-h-64 overflow-y-auto mb-4 rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  <th className="py-2 px-2 text-left w-8">
                    <input
                      type="checkbox"
                      checked={selectedExecIds.size === execHistory.length && execHistory.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedExecIds(new Set(execHistory.map((r) => r.id)))
                        else setSelectedExecIds(new Set())
                      }}
                    />
                  </th>
                  {["Name", "Algorithm", "Status", "Date", "Size"].map((h) => (
                    <th key={h} className="py-2 px-2 text-left text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {execHistory.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                    <td className="py-1.5 px-2">
                      <input
                        type="checkbox"
                        checked={selectedExecIds.has(r.id)}
                        onChange={(e) => {
                          const next = new Set(selectedExecIds)
                          if (e.target.checked) next.add(r.id)
                          else next.delete(r.id)
                          setSelectedExecIds(next)
                        }}
                      />
                    </td>
                    <td className="py-1.5 px-2 font-medium text-foreground">{r.circuit_name || "—"}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{r.algorithm || "—"}</td>
                    <td className="py-1.5 px-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${r.status === "completed" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                        {r.status === "completed" ? "Success" : r.status}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">
                      {r.size_bytes < 1024 ? `${r.size_bytes} B` : `${(r.size_bytes / 1024).toFixed(1)} kB`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {selectedExecIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={isDeletingExecs}
              className="flex items-center gap-2 text-destructive hover:text-destructive border-destructive"
            >
              <Trash2 size={14} />
              {isDeletingExecs ? "Deleting…" : `Delete Selected (${selectedExecIds.size})`}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowClearHistoryConfirm(true)}
            disabled={execHistory.length === 0 || isClearingHistory}
            className="flex items-center gap-2 text-destructive hover:text-destructive border-destructive ml-auto"
          >
            <Trash2 size={14} />
            Clear All History
          </Button>
        </div>
      </Card>

      {/* Preferences */}
      <Card className="p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6">Preferences</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Language</p>
              <p className="text-sm text-muted-foreground">Choose your preferred language</p>
            </div>
            <LanguageSelector />
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <p className="font-medium text-foreground">Email Notifications</p>
              <p className="text-sm text-muted-foreground">Get major updates to leverage your computing</p>
            </div>
            <input type="checkbox" defaultChecked className="w-6 h-6" />
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <p className="font-medium text-foreground flex items-center gap-2">
                {darkModeEnabled ? (
                  <Moon size={18} className="text-primary" />
                ) : (
                  <Sun size={18} className="text-primary" />
                )}
                {darkModeEnabled ? "Dark Mode" : "Light Mode"}
              </p>
              <p className="text-sm text-muted-foreground">Toggle between light and dark</p>
            </div>
            <button
              onClick={handleDarkModeToggle}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                darkModeEnabled ? "bg-primary" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  darkModeEnabled ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <p className="font-medium text-foreground">Improve Models</p>
              <p className="text-sm text-muted-foreground">{"Share benchmarks"}</p>
            </div>
            <button
              onClick={handleImproveModelsToggle}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                improveModelsEnabled ? "bg-primary" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  improveModelsEnabled ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <p className="font-medium text-foreground">Stay Logged In</p>
              <p className="text-sm text-muted-foreground">Keep me signed in on this device.</p>
            </div>
            <button
              onClick={handleStayLoggedInToggle}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                stayLoggedIn ? "bg-primary" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  stayLoggedIn ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </Card>

      {/* Billing & Plans */}
      <Card className="p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6">Billing & Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {plans.map((plan, i) => (
            <div key={i} className="p-6 border border-border rounded-lg flex flex-col shadow-md">
              <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
              <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-primary">{plan.price}</span>
                <span className="text-muted-foreground text-sm ml-2">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-6 flex-grow">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <Check className="text-primary flex-shrink-0 mt-0.5" size={18} />
                    <span className="text-foreground text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={plan.current ? "bg-primary hover:bg-primary/90" : ""}
                variant={plan.current ? undefined : "outline"}
                disabled={plan.comingSoon}
              >
                {plan.current ? "Current Plan" : plan.comingSoon ? "Coming Soon" : plan.name === "Enterprise" ? "Contact Us" : "Choose Plan"}
              </Button>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-xl font-bold text-foreground mb-2">Billing</h3>
          <p className="text-muted-foreground">Coming Soon</p>
        </div>
      </Card>

      <div className="flex justify-end gap-2 my-0">
        <Button
          variant="outline"
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 bg-transparent border-destructive"
        >
          <Trash2 size={18} />
          Delete Account
        </Button>
        <Button
          variant="outline"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground bg-transparent"
        >
          {isLoggingOut ? (
            <>
              <span className="inline-block w-4 h-4 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              Signing out...
            </>
          ) : (
            <>
              <LogOut size={18} />
              Sign Out
            </>
          )}
        </Button>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-foreground mb-4">Delete Account</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete your account? This action cannot be undone and will permanently delete all
              your data, including execution logs and circuit history.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {isDeleting ? (
                  <>
                    <span className="inline-block w-4 h-4 border-4 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  "Delete Account"
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showClearHistoryConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-foreground mb-4">Clear All Execution History</h3>
            <p className="text-muted-foreground mb-6">
              This will permanently delete all {execTotalRows} saved execution{execTotalRows !== 1 ? "s" : ""} and free{" "}
              {(execStorageUsed / 1_048_576).toFixed(2)} MB of storage. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowClearHistoryConfirm(false)} disabled={isClearingHistory}>
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleClearAllHistory}
                disabled={isClearingHistory}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {isClearingHistory ? (
                  <>
                    <span className="inline-block w-4 h-4 border-4 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Clearing…
                  </>
                ) : (
                  "Clear All"
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
