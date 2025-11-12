"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Zap, BookOpen, Settings, CreditCard } from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/runner", label: "Runner", icon: Zap },
  { href: "/templates", label: "Templates", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-border flex justify-around items-center h-16 z-50">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors ${
              isActive ? "text-sidebar-primary" : "text-sidebar-foreground"
            }`}
          >
            <Icon size={24} />
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
