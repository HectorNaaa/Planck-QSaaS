import type React from "react"
import type { Metadata } from "next"
import { Lora } from "next/font/google"
import { Geist_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { LanguageProvider } from "@/contexts/language-context"
import "./globals.css"

const _lora = Lora({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Planck Quantum SaaS - Effortless Quantum Computing",
  description:
    "Build and run quantum algorithms with Planck. Simple, powerful, and accessible quantum computing platform.",
  icons: {
    icon: "/logo-isotipo.png",
    apple: "/logo-isotipo.png",
  },
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
