"use client"

import { useLanguage } from "@/contexts/language-context"
import { Globe } from 'lucide-react'

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="relative">
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as "en" | "es")}
        className="appearance-none bg-background border-border rounded-lg px-3 py-2 pr-8 text-sm font-medium text-foreground hover:bg-accent transition-colors cursor-pointer border-0"
      >
        <option value="en">EN</option>
        <option value="es">ES</option>
      </select>
      <Globe className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} />
    </div>
  )
}
