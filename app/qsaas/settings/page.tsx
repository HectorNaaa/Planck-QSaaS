"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Save, Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [darkModeEnabled, setDarkModeEnabled] = useState(theme === "dark")

  const handleDarkModeToggle = () => {
    const newMode = !darkModeEnabled
    setDarkModeEnabled(newMode)
    setTheme(newMode ? "dark" : "light")
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences.</p>
      </div>

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
        </div>
      </Card>

      {/* Save */}
      <Button className="bg-primary hover:bg-primary/90 flex items-center gap-2">
        <Save size={18} />
        Save Changes
      </Button>
    </div>
  )
}
