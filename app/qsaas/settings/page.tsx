"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Save, Sun, Moon, Check, LogOut, Trash2, Edit, Copy, RefreshCw } from "lucide-react"
import { useTheme } from "next-themes"
import { PageHeader } from "@/components/page-header"
import { createClient, createBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { LanguageSelector } from "@/components/language-selector"
import { deleteUserAccount, updateUserAccount } from "./actions"

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
  const [apiKey, setApiKey] = useState("sk_live_4f8b2a9c1e6d3h7k")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const loadUserData = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setUserEmail(user.email || "")
        setOriginalEmail(user.email || "")

        const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

        if (profile) {
          const fullName = profile.name || ""
          const [first, ...rest] = fullName.split(" ")
          setUserFirstName(first || "")
          setUserLastName(rest.join(" ") || "")
          setUserName(fullName)
          setUserOrg(profile.org || "")
          setUserCountry(profile.country || "")
          setUserPhone(profile.phone_number || "")
          setUserOccupation(profile.occupation || "")
          setStayLoggedIn(profile.stay_logged_in !== false)
        }
      }

      const stayLoggedInPref = localStorage.getItem("planck_stay_logged_in")
      setStayLoggedIn(stayLoggedInPref !== "false")
    }

    loadUserData()
  }, [])

  const handleDarkModeToggle = () => {
    const newMode = !darkModeEnabled
    setDarkModeEnabled(newMode)
    setTheme(newMode ? "dark" : "light")
  }

  const handleImproveModelsToggle = () => {
    setImproveModelsEnabled(!improveModelsEnabled)
  }

  const handleStayLoggedInToggle = async () => {
    const newValue = !stayLoggedIn
    setStayLoggedIn(newValue)
    localStorage.setItem("planck_stay_logged_in", String(newValue))

    try {
      const supabase = createBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        await supabase
          .from("profiles")
          .update({
            stay_logged_in: newValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id)
      }
    } catch (error) {
      console.error("[v0] Error saving stay logged in preference:", error)
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    const supabase = createClient()

    try {
      await supabase.auth.signOut()
      document.cookie = "planck_session=; max-age=0; path=/"
      localStorage.removeItem("planck_stay_logged_in")
      router.push("/auth/login")
    } catch (error) {
      console.error("Logout error:", error)
      router.push("/auth/login")
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleDeleteAccount = async () => {
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
    navigator.clipboard.writeText(apiKey)
    alert("API key copied to clipboard!")
  }

  const handleRegenerateApiKey = () => {
    const newKey = `sk_live_${Math.random().toString(36).substring(2, 18)}`
    setApiKey(newKey)
    alert("New API key generated!")
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
        "Pre-built circuits",
        "Basic analytics",
        "Community support",
      ],
      current: false,
    },
    {
      name: "Pro",
      price: "€49",
      period: "/month",
      description: "For professionals and teams",
      features: [
        "QPUs and quantum-inspired",
        "Up to 36 qubits",
        "Pre-built circuits",
        "Advanced analytics",
        "Priority support",
        "Error Mitigation",
        "API access",
      ],
      current: true,
    },
    {
      name: "Custom",
      price: "Contact",
      period: "us",
      description: "Enterprise quantum solutions",
      features: [
        "QPUs and quantum-inspired",
        "Up to 36 qubits",
        "Custom circuits",
        "Custom analytics",
        "Priority support",
        "Error Mitigation",
        "API access",
        "Queue priority",
        "Team education",
      ],
      current: false,
    },
  ]

  return (
    <div className="p-8 px-4 space-y-4 py-4">
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
      </Card>

      {/* API Keys */}
      <Card className="p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6">API Keys</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border">
            <div className="flex-1">
              <p className="font-medium text-foreground">Production Key</p>
              <p className="text-sm text-muted-foreground font-mono">{apiKey}</p>
            </div>
            <div className="flex gap-2">
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
                onClick={handleRegenerateApiKey}
                className="flex items-center gap-2 bg-transparent"
              >
                <RefreshCw size={16} />
                Regenerate
              </Button>
            </div>
          </div>
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
              <p className="text-sm text-muted-foreground">Toggle between light and dark themes</p>
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
              <p className="text-sm text-muted-foreground">
                Help us improve algorithms by sharing your benchmarks and usage data
              </p>
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
              <p className="text-sm text-muted-foreground">
                Keep me signed in on this device without requiring login each time
              </p>
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
              >
                {plan.current ? "Current Plan" : "Choose Plan"}
              </Button>
            </div>
          ))}
        </div>

        <h3 className="text-xl font-bold text-foreground mb-4">Billing History</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Date</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Description</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Amount</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border hover:bg-secondary/50 transition">
                <td className="py-3 px-4 text-foreground">Nov 1, 2024</td>
                <td className="py-3 px-4 text-foreground">Pro Plan - Monthly</td>
                <td className="py-3 px-4 text-foreground">€49.00</td>
                <td className="py-3 px-4">
                  <span className="inline-block px-3 py-1 rounded-full text-sm bg-primary/20 text-primary">Paid</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-between items-center my-0">
        <Button className="bg-primary hover:bg-primary/90 flex items-center gap-2">
          <Save size={18} />
          Save Changes
        </Button>
        <div className="flex gap-2">
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
    </div>
  )
}
