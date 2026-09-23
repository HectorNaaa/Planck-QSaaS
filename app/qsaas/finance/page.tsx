/**
 * app/qsaas/finance/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * "Finance Twins" is no longer a separate tab — the 3 finance modules now
 * live as tagged presets inside the Templates tab. Redirect old bookmarks
 * and links there instead of showing a removed section.
 */
import { redirect } from "next/navigation"

export default function FinanceRedirectPage() {
  redirect("/qsaas/templates")
}

