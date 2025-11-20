"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, Zap, BarChart3, GitBranch, Menu, X } from "lucide-react"
import { PricingSection } from "@/components/pricing-section"
import { HeroAnimation } from "@/components/hero-animation"
import { FAQSection } from "@/components/faq-section"
import { TitleAnimation } from "@/components/title-animation"
import { LanguageSelector } from "@/components/language-selector"
import { useLanguage } from "@/contexts/language-context"
import React from "react"
import { Footer } from "@/components/footer"

export default function LandingPage() {
  const [scrollRotation, setScrollRotation] = React.useState(0)
  const [glowOpacity, setGlowOpacity] = React.useState(1)
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const { t } = useLanguage()
  const heroRef = React.useRef<HTMLElement>(null)

  React.useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      setScrollRotation(scrollY * 0.2)

      if (heroRef.current) {
        const heroRect = heroRef.current.getBoundingClientRect()
        const heroCenter = heroRect.top + heroRect.height / 2
        const viewportCenter = window.innerHeight / 2

        const distance = Math.abs(heroCenter - viewportCenter)

        const fadeDistance = window.innerHeight * 0.5

        const opacity = Math.max(0, 1 - distance / fadeDistance)

        setGlowOpacity(opacity)
      }
    }

    window.addEventListener("scroll", handleScroll)
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-3 left-3 right-3 z-50 bg-background/95 backdrop-blur-sm border-b border-border shadow-lg rounded-lg opacity-[0.96]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 shadow-xl">
          <div className="hidden md:flex justify-between items-center">
            <Image
              src="/images/design-mode/Planck%20Logotype%20no%20bg(2).png"
              alt="Planck Logo"
              width={140}
              height={45}
              className="h-10 w-auto"
            />
            <nav className="flex gap-8 items-center justify-center">
              <a href="#features" className="text-foreground hover:text-primary transition">
                Features
              </a>
              <a href="#pricing" className="text-foreground hover:text-primary transition">
                Pricing
              </a>
              <a href="#faq" className="text-foreground hover:text-primary transition">
                FAQs
              </a>
            </nav>
            <Link href="/auth/login">
              <Button className="bg-primary hover:bg-primary/90 text-lg transition-transform duration-300 hover:scale-105 hover:shadow-xl shadow-primary/30 px-6 py-2.5">
                Access
              </Button>
            </Link>
          </div>

          <div className="md:hidden flex justify-between items-center">
            <Image
              src="/images/design-mode/Planck%20Logotype%20no%20bg(2).png"
              alt="Planck Logo"
              width={120}
              height={38}
              className="h-8 w-auto"
            />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-sm">
            <div className="px-4 py-6 space-y-4">
              <a
                href="#features"
                className="block text-center py-2 text-foreground hover:text-primary transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
              <a
                href="#pricing"
                className="block text-center py-2 text-foreground hover:text-primary transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </a>
              <a
                href="#faq"
                className="block text-center py-2 text-foreground hover:text-primary transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                FAQs
              </a>
              <div className="flex justify-center pt-2">
                <LanguageSelector />
              </div>
              <div className="pt-4 border-t border-border">
                <Link href="/auth/login">
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 transition-transform duration-300 hover:scale-105"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Access
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="pt-24">
        <section
          ref={heroRef}
          data-hn-hero
          className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 overflow-hidden md:py-[380px]"
          style={{ "--scroll-rotation": `${scrollRotation}deg`, "--glow-opacity": glowOpacity } as React.CSSProperties}
        >
          <div className="absolute inset-0 -z-10">
            <HeroAnimation />
          </div>
          <div className="absolute inset-0 -z-10">
            <TitleAnimation />
          </div>

          <div className="flex flex-col items-center gap-12 relative z-10">
            <div className="text-center space-y-6">
              <h1
                className="hn-slogan-wrap text-5xl md:text-7xl font-bold text-foreground text-balance"
                style={{ "--scroll-rotation": `${scrollRotation}deg` } as React.CSSProperties}
              >
                Effortless <span className="text-primary">Quantum Solutions</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
                Welcome to the new computing era, connect your data and start using quantum computing. AI-Enhanced.
              </p>
              <div className="flex gap-4 justify-center flex-wrap pt-4">
                <Link href="/auth/login">
                  <Button
                    size="lg"
                    className="hn-cta bg-primary hover:bg-primary/90 text-lg px-8 transition-transform duration-300 hover:scale-105 hover:shadow-xl shadow-primary/30 shadow-xl"
                  >
                    Access <ArrowRight className="ml-2" size={20} />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 hover:shadow-lg transition-all duration-300 hover:scale-105 bg-secondary shadow-lg"
                >
                  Watch Demo
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 my-0">
          <h2 className="text-4xl font-bold text-foreground mb-12 text-center">Features</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: "Lightning Fast",
                description: "53x faster executions than quantum market standards",
              },
              {
                icon: BarChart3,
                title: "Powerful Analytics",
                description: "Monitor, ask and analyze quantum data",
              },
              {
                icon: GitBranch,
                title: "Hybrid Approach",
                description: "Toggle auto/manual settings. Change between classic/quantum instances",
              },
            ].map((feature, i) => {
              const Icon = feature.icon
              return (
                <div
                  key={i}
                  className="border border-border p-8 hover:shadow-lg transition hover:shadow-xl hover:scale-105 duration-300 shadow-lg rounded-lg bg-secondary"
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
          <h2 className="text-4xl font-bold text-foreground mb-6">Welcome to the new computing era</h2>
          
          <Link href="/auth/login">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-lg px-8 transition-transform duration-300 hover:scale-105 hover:shadow-xl shadow-primary/30 shadow-lg"
            >
              Access <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </section>

        <Footer />
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
            rgba(87, 142, 126, 0.47) 30%,
            rgba(87, 142, 126, 0.23) 50%,
            transparent 75%
          );
          opacity: calc(0.35 * var(--glow-opacity, 1));
          filter: blur(60px);
          z-index: -1;
          animation: hn-halo-pulse 3s ease-in-out infinite, hn-halo-drift 8s ease-in-out infinite alternate;
          transform: rotate(var(--scroll-rotation, 0deg));
          transition: transform 0.1s ease-out, opacity 0.15s ease-out;
        }

        [data-hn-hero] .hn-slogan-wrap::after {
          content: '';
          position: absolute;
          inset: -2rem;
          background: radial-gradient(
            circle at center,
            rgba(87, 142, 126, 0.62) 0%,
            rgba(87, 142, 126, 0.31) 40%,
            transparent 70%
          );
          opacity: calc(0.26 * var(--glow-opacity, 1));
          filter: blur(45px);
          z-index: -1;
          animation: hn-halo-pulse 3s ease-in-out infinite 0.5s;
          transform: rotate(calc(var(--scroll-rotation, 0deg) * -1.5));
          transition: transform 0.1s ease-out, opacity 0.15s ease-out;
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
            rgba(87, 142, 126, 0.91) 40%,
            transparent 75%
          );
          opacity: calc(0.84 * var(--glow-opacity, 1));
          filter: blur(12px);
          animation: hn-glow-pulse 2.5s ease-in-out infinite;
          transition: opacity 0.15s ease-out;
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
            rgba(87, 142, 126, 1) 0%,
            rgba(87, 142, 126, 0.65) 50%,
            transparent 80%
          );
          opacity: calc(0.68 * var(--glow-opacity, 1));
          filter: blur(8px);
          animation: hn-glow-pulse 2.5s ease-in-out infinite 0.3s, hn-shimmer 4s ease-in-out infinite;
          transition: opacity 0.15s ease-out;
        }

        @keyframes hn-halo-pulse {
          0%, 100% {
            opacity: 0.23;
            transform: scale(1);
          }
          50% {
            opacity: 0.35;
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
            opacity: 0.52;
            transform: scaleY(1);
          }
          50% {
            opacity: 0.85;
            transform: scaleY(1.15);
          }
        }

        @keyframes hn-shimmer {
          0%, 100% {
            transform: translateX(0) scaleX(1);
            opacity: 0.52;
          }
          50% {
            transform: translateX(3px) scaleX(1.1);
            opacity: 0.78;
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
