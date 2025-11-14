"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Zap, BookOpen, Settings, CreditCard, LogOut } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { useState } from "react"
import { LoadingSpinner } from "@/components/loading-spinner"

const navItems = [
  { href: "/qsaas/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/qsaas/runner", label: "Quantum Runner", icon: Zap },
  { href: "/qsaas/templates", label: "Templates", icon: BookOpen },
  { href: "/qsaas/settings", label: "Settings", icon: Settings },
  { href: "/qsaas/billing", label: "Billing", icon: CreditCard },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    const supabase = createClient()

    try {
      await supabase.auth.signOut()
      router.push("/auth/login")
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header with Logo */}
      <div className="p-4 border-sidebar-border flex items-center justify-between border-b-0">
        <Link
          href="/"
          className="flex items-center hover:opacity-80 transition-opacity flex-shrink-0"
          title="Back to home"
        >
          <Image
            src="/logo-isotipo.png"
            alt="Planck Logo"
            width={40}
            height={40}
            className="w-10 h-10 object-contain"
            priority
          />
        </Link>
        <ThemeToggle />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer with Logout */}
      <div className="p-4 border-sidebar-border border-t-[2p0]">
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors disabled:opacity-50"
        >
          {isLoggingOut ? (
            <>
              <LoadingSpinner size="sm" />
              <span className="font-medium">Signing out...</span>
            </>
          ) : (
            <>
              <LogOut size={20} />
              <span className="font-medium">Sign Out</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
