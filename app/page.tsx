"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, Zap, BarChart3, GitBranch, Menu, X } from 'lucide-react'
import { PricingSection } from "@/components/pricing-section"
import { HeroAnimation } from "@/components/hero-animation"
import { FAQSection } from "@/components/faq-section"
import { TitleAnimation } from "@/components/title-animation"
import { LanguageSelector } from "@/components/language-selector"
import { useLanguage } from "@/contexts/language-context"
import React from "react"

export default function LandingPage() {
  const [scrollRotation, setScrollRotation] = React.useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const { t } = useLanguage()

  React.useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      setScrollRotation(scrollY * 0.2)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-3 left-3 right-3 z-50 bg-background/95 backdrop-blur-sm border-b border-border shadow-lg rounded-lg opacity-[0.96]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="hidden md:flex items-center gap-8">
            <Image
              src="/images/design-mode/Planck%20Logotype%20no%20bg(2).png"
              alt="Planck Logo"
              width={140}
              height={45}
              className="h-10 w-auto"
            />
            <nav className="flex gap-8 items-center">
              <a href="#features" className="text-foreground hover:text-primary transition">
                {t("nav.features")}
              </a>
              <a href="#pricing" className="text-foreground hover:text-primary transition">
                {t("nav.pricing")}
              </a>
              <a href="#faq" className="text-foreground hover:text-primary transition">
                FAQs
              </a>
              <a href="#docs" className="text-foreground hover:text-primary transition">
                {t("nav.docs")}
              </a>
            </nav>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 hover:bg-accent rounded-lg transition-colors"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <Link href="/auth/login" className="hidden md:block">
            <Button className="bg-primary hover:bg-primary/90 text-lg transition-transform duration-300 hover:scale-105 hover:shadow-xl shadow-primary/30 px-6 py-2.5">
              {t("hero.access")}
            </Button>
          </Link>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-sm">
            <div className="px-4 py-6 space-y-4">
              <div className="flex justify-center mb-4">
                <Image
                  src="/images/design-mode/Planck%20Logotype%20no%20bg(2).png"
                  alt="Planck Logo"
                  width={120}
                  height={38}
                  className="h-8 w-auto"
                />
              </div>
              <a 
                href="#features" 
                className="block text-center py-2 text-foreground hover:text-primary transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("nav.features")}
              </a>
              <a 
                href="#pricing" 
                className="block text-center py-2 text-foreground hover:text-primary transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("nav.pricing")}
              </a>
              <a 
                href="#faq" 
                className="block text-center py-2 text-foreground hover:text-primary transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                FAQs
              </a>
              <a 
                href="#docs" 
                className="block text-center py-2 text-foreground hover:text-primary transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("nav.docs")}
              </a>
              <div className="flex justify-center pt-2">
                <LanguageSelector />
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="pt-24">
        <section data-hn-hero className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 overflow-hidden md:py-[380px]">
          <div className="absolute inset-0 -z-10">
            <HeroAnimation />
          </div>
          <div className="absolute inset-0 -z-10">
            <TitleAnimation />
          </div>

          <div className="flex flex-col items-center gap-12 relative z-10">
            <div className="text-center space-y-6">
              <h1 className="hn-slogan-wrap text-5xl md:text-7xl font-bold text-foreground text-balance" style={{ '--scroll-rotation': `${scrollRotation}deg` } as React.CSSProperties}>
                {t("hero.title")} <span className="text-primary">{t("hero.quantum")}</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
                {t("hero.subtitle")}
              </p>
              <div className="flex gap-4 justify-center flex-wrap pt-4">
                <Link href="/auth/login">
                  <Button
                    size="lg"
                    className="hn-cta bg-primary hover:bg-primary/90 text-lg px-8 transition-transform duration-300 hover:scale-105 hover:shadow-xl shadow-primary/30 shadow-xl"
                  >
                    {t("hero.access")} <ArrowRight className="ml-2" size={20} />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 hover:shadow-lg transition-all duration-300 hover:scale-105 bg-secondary shadow-lg"
                >
                  {t("hero.demo")}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 my-0">
          <h2 className="text-4xl font-bold text-foreground mb-12 text-center">{t("features.title")}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: t("features.fast.title"),
                description: t("features.fast.desc"),
              },
              {
                icon: BarChart3,
                title: t("features.analytics.title"),
                description: t("features.analytics.desc"),
              },
              {
                icon: GitBranch,
                title: t("features.hybrid.title"),
                description: t("features.hybrid.desc"),
              },
            ].map((feature, i) => {
              const Icon = feature.icon
              return (
                <div
                  key={i}
                  className="border border-border p-8 hover:shadow-lg transition hover:shadow-xl hover:scale-105 duration-300 shadow-lg rounded-lg bg-card"
                >
                  <Icon className="text-primary mb-4" size={32} />
                  <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-center">
            <Image
              src="/images/computing-20evolution-20no-20slogan.png"
              alt="Computing Evolution"
              width={600}
              height={180}
              className="rounded-lg"
            />
          </div>
        </section>

        <div id="pricing">
          <PricingSection />
        </div>

        <FAQSection />

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-4xl font-bold text-foreground mb-6">{t("cta.title")}</h2>
          <p className="text-lg text-muted-foreground mb-8">{t("cta.subtitle")}</p>
          <Link href="/auth/login">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-lg px-8 transition-transform duration-300 hover:scale-105 hover:shadow-xl shadow-primary/30 shadow-lg"
            >
              {t("hero.access")} <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </section>

        <footer className="border-t border-border shadow-sm bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-muted-foreground">
            <p>{t("footer.copyright")}</p>
          </div>
        </footer>
      </div>

      <style jsx>{`
        [data-hn-hero] .hn-slogan-wrap {
          position: relative;
          display: inline-block;
        }

        [data-hn-hero] .hn-slogan-wrap::before {
          content: '';
          position: absolute;
          inset: -3rem;
          background: radial-gradient(
            ellipse 120% 100% at center,
            var(--primary, #578e7e) 0%,
            rgba(87, 142, 126, 0.36) 30%,
            rgba(87, 142, 126, 0.18) 50%,
            transparent 75%
          );
          opacity: 0.21;
          filter: blur(60px);
          z-index: -1;
          animation: hn-halo-pulse 3s ease-in-out infinite, hn-halo-drift 8s ease-in-out infinite alternate;
          transform: rotate(var(--scroll-rotation, 0deg));
          transition: transform 0.1s ease-out;
        }

        [data-hn-hero] .hn-slogan-wrap::after {
          content: '';
          position: absolute;
          inset: -2rem;
          background: radial-gradient(
            circle at center,
            rgba(87, 142, 126, 0.48) 0%,
            rgba(87, 142, 126, 0.24) 40%,
            transparent 70%
          );
          opacity: 0.15;
          filter: blur(45px);
          z-index: -1;
          animation: hn-halo-pulse 3s ease-in-out infinite 0.5s;
          transform: rotate(calc(var(--scroll-rotation, 0deg) * -1.5));
          transition: transform 0.1s ease-out;
        }

        [data-hn-hero] .hn-cta {
          position: relative;
        }

        [data-hn-hero] .hn-cta::before {
          content: '';
          position: absolute;
          bottom: -12px;
          left: 5%;
          right: 5%;
          height: 20px;
          background: radial-gradient(
            ellipse at center,
            var(--primary, #578e7e) 0%,
            rgba(87, 142, 126, 0.7) 40%,
            transparent 75%
          );
          opacity: 0.5;
          filter: blur(12px);
          animation: hn-glow-pulse 2.5s ease-in-out infinite;
        }

        [data-hn-hero] .hn-cta::after {
          content: '';
          position: absolute;
          bottom: -8px;
          left: 15%;
          right: 15%;
          height: 16px;
          background: radial-gradient(
            ellipse at center,
            rgba(87, 142, 126, 0.9) 0%,
            rgba(87, 142, 126, 0.5) 50%,
            transparent 80%
          );
          opacity: 0.4;
          filter: blur(8px);
          animation: hn-glow-pulse 2.5s ease-in-out infinite 0.3s, hn-shimmer 4s ease-in-out infinite;
        }

        @keyframes hn-halo-pulse {
          0%, 100% {
            opacity: 0.18;
            transform: scale(1);
          }
          50% {
            opacity: 0.27;
            transform: scale(1.08);
          }
        }

        @keyframes hn-halo-drift {
          0%, 100% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-8px) translateX(5px);
          }
        }

        @keyframes hn-halo-rotate {
          0% {
            transform: rotate(0deg) scale(1);
          }
          50% {
            transform: rotate(180deg) scale(1.05);
          }
          100% {
            transform: rotate(360deg) scale(1);
          }
        }

        @keyframes hn-glow-pulse {
          0%, 100% {
            opacity: 0.4;
            transform: scaleY(1);
          }
          50% {
            opacity: 0.65;
            transform: scaleY(1.15);
          }
        }

        @keyframes hn-shimmer {
          0%, 100% {
            transform: translateX(0) scaleX(1);
            opacity: 0.4;
          }
          50% {
            transform: translateX(3px) scaleX(1.1);
            opacity: 0.6;
          }
        }

        @media (max-width: 768px) {
          [data-hn-hero] .hn-slogan-wrap::before {
            filter: blur(30px);
            inset: -2rem;
          }
          [data-hn-hero] .hn-slogan-wrap::after {
            filter: blur(25px);
          }
          [data-hn-hero] .hn-cta::before {
            filter: blur(6px);
          }
          [data-hn-hero] .hn-cta::after {
            filter: blur(4px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          [data-hn-hero] .hn-slogan-wrap::before,
          [data-hn-hero] .hn-slogan-wrap::after,
          [data-hn-hero] .hn-cta::before,
          [data-hn-hero] .hn-cta::after {
            animation: none;
          }
        }

        [data-hn-hero].hn-disable .hn-slogan-wrap::before,
        [data-hn-hero].hn-disable .hn-slogan-wrap::after,
        [data-hn-hero].hn-disable .hn-cta::before,
        [data-hn-hero].hn-disable .hn-cta::after {
          display: none;
        }
      `}</style>
    </div>
  )
}
