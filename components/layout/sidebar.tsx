"use client"

import Link from "next/link"
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Zap, BookOpen, Settings } from 'lucide-react'
import { ThemeToggle } from "@/components/theme-toggle"
import Image from "next/image"
import { useLanguage } from "@/contexts/language-context"

export function Sidebar() {
  const pathname = usePathname()
  const { t } = useLanguage()

  const navItems = [
    { href: "/qsaas/dashboard", label: t("sidebar.dashboard"), icon: LayoutDashboard },
    { href: "/qsaas/runner", label: "Runner", icon: Zap },
    { href: "/qsaas/templates", label: t("sidebar.templates"), icon: BookOpen },
    { href: "/qsaas/settings", label: t("sidebar.settings"), icon: Settings },
  ]

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-4 border-sidebar-border flex items-center justify-between border-b gap-2">
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
    </aside>
  )
}
