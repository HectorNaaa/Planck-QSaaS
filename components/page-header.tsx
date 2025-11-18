'use client'

import Image from "next/image"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

interface PageHeaderProps {
  title: string
  description?: string
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <>
      {/* Mobile-only header - hidden on desktop */}
      <div className="lg:hidden flex items-center border-secondary justify-between mb-8">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <Image
            src="/logo-isotipo.png"
            alt="Planck"
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
          />
        </Link>
        <ThemeToggle />
      </div>

      {/* Page title section */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
    </>
  )
}
