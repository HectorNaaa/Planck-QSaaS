"use client"

import Link from "next/link"
import { Linkedin, Github } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

export function Footer() {
  const { t } = useLanguage()

  return (
    <footer className="border-border bg-background border-t-[0p0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-9">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            
            <div className="flex gap-4">
              <a
                href="https://www.linkedin.com/company/planck-technologies-xyz/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin size={32} />
              </a>
              <a
                href="https://github.com/Planck-Technologies"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="GitHub"
              >
                <Github size={32} />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-4">{t("Sections")}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#features" className="text-muted-foreground hover:text-primary transition-colors">
                  {t("Features")}
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-muted-foreground hover:text-primary transition-colors">
                  {t("Pricing")}
                </a>
              </li>
              <li>
                <a href="#faq" className="text-muted-foreground hover:text-primary transition-colors">
                  {t("FAQs")}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-4">{t("Legal")}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                  {t("Privacy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                  {t("Terms")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-border text-center text-sm text-muted-foreground border-t-[3px]">
          <p className="text-secondary-foreground">{t("© 2025 Planck Technologies")}</p>
        </div>
      </div>
    </footer>
  )
}
