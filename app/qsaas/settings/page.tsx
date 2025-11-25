"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Save, Sun, Moon, Check, LogOut } from "lucide-react"
import { useTheme } from "next-themes"
import { PageHeader } from "@/components/page-header"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { LoadingSpinner } from "@/components/loading-spinner"
import { LanguageSelector } from "@/components/language-selector"
import { clearSession } from "@/lib/auth-session"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [darkModeEnabled, setDarkModeEnabled] = useState(theme === "dark")
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [improveModelsEnabled, setImproveModelsEnabled] = useState(true)

  const handleDarkModeToggle = () => {
    const newMode = !darkModeEnabled
    setDarkModeEnabled(newMode)
    setTheme(newMode ? "dark" : "light")
  }

  const handleImproveModelsToggle = () => {
    setImproveModelsEnabled(!improveModelsEnabled)
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    const supabase = createClient()

    try {
      await supabase.auth.signOut()
      clearSession()
      router.push("/auth/login")
    } catch (error) {
      console.error("Logout error:", error)
      clearSession()
      router.push("/auth/login")
    } finally {
      setIsLoggingOut(false)
    }
  }

  const plans = [
    {
      name: "Free",
      price: "€0",
      period: "/month",
      description: "Perfect for learning",
      features: ["100 circuit runs/month", "Up to 4 qubits", "Community support", "Basic analytics"],
      current: false,
    },
    {
      name: "Pro",
      price: "€49",
      period: "/month",
      description: "For active researchers",
      features: [
        "50,000 circuit runs/month",
        "Up to 20 qubits",
        "Priority support",
        "Advanced analytics",
        "Custom templates",
      ],
      current: true,
    },
    {
      name: "Custom",
      price: "Contact",
      period: "us",
      description: "Quantum consulting",
      features: [
        "Unlimited circuit runs",
        "Custom quantum circuits",
        "Priority queue execution",
        "Advanced settings",
        "Dedicated support",
      ],
      current: false,
    },
  ]

  return (
    <div className="p-8 px-4 space-y-4 py-4">
      <PageHeader title="Settings" description="Manage your account and preferences." />

      {/* Account Settings */}
      <Card className="p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6">Account</h2>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Full Name</label>
              <input
                type="text"
                placeholder="John Quantum"
                className="w-full px-4 py-2 rounded-lg border border-border bg-secondary/50 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Email</label>
              <input
                type="email"
                placeholder="john@planck.com"
                className="w-full px-4 py-2 rounded-lg border border-border bg-secondary/50 text-foreground"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Organization</label>
            <input
              type="text"
              placeholder="Quantum Research Lab"
              className="w-full px-4 py-2 rounded-lg border border-border bg-secondary/50 text-foreground"
            />
          </div>
        </div>
      </Card>

      {/* API Keys */}
      <Card className="p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6">API Keys</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border">
            <div>
              <p className="font-medium text-foreground">Production Key</p>
              <p className="text-sm text-muted-foreground">sk_live_••••••••••••••••</p>
            </div>
            <Button variant="outline" size="sm">
              Copy
            </Button>
          </div>
          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border">
            <div>
              <p className="font-medium text-foreground">Development Key</p>
              <p className="text-sm text-muted-foreground">sk_test_••••••••••••••••</p>
            </div>
            <Button variant="outline" size="sm">
              Copy
            </Button>
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
              <p className="text-sm text-muted-foreground">Get updates about circuit runs</p>
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
        <Button
          variant="outline"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 bg-transparent"
        >
          {isLoggingOut ? (
            <>
              <LoadingSpinner size="sm" />
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
  )
}
