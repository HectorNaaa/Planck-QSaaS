"use client"

import Link from "next/link"
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Zap, BookOpen, Settings } from 'lucide-react'

export function MobileBottomNav() {
  const pathname = usePathname()

  const navItems = [
    { href: "/qsaas/dashboard", icon: LayoutDashboard },
    { href: "/qsaas/runner", icon: Zap },
    { href: "/qsaas/templates", icon: BookOpen },
    { href: "/qsaas/settings", icon: Settings },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-sidebar border-sidebar-border flex justify-around items-center h-16 z-50 px-2 py-2 border-t-0 shadow-lg opacity-95" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-center p-3 transition-colors py-2 ${
              isActive ? "text-sidebar-primary" : "text-sidebar-foreground"
            }`}
          >
            <Icon size={24} />
          </Link>
        )
      })}
    </nav>
  )
}
