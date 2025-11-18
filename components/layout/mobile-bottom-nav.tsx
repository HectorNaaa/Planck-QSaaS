"use client"

import Link from "next/link"
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Zap, BookOpen, Settings, CreditCard } from 'lucide-react'
import { useLanguage } from "@/contexts/language-context"

export function MobileBottomNav() {
  const pathname = usePathname()
  const { t } = useLanguage()

  const navItems = [
    { href: "/qsaas/dashboard", label: t("sidebar.dashboard"), icon: LayoutDashboard },
    { href: "/qsaas/runner", label: "Runner", icon: Zap },
    { href: "/qsaas/templates", label: t("sidebar.templates"), icon: BookOpen },
    { href: "/qsaas/settings", label: t("sidebar.settings"), icon: Settings },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-border flex justify-around items-center h-16 z-50 pb-safe">
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
            <Icon size={20} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
