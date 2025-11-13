"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, Zap, BarChart3, Lock } from "lucide-react"
import { PricingSection } from "@/components/pricing-section"
import { HeroAnimation } from "@/components/hero-animation"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-3 left-3 right-3 z-50 bg-background/95 backdrop-blur-sm border-b border-border shadow-lg rounded-lg opacity-[0.98]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <Image
              src="/images/design-mode/Planck%20Logotype%20no%20bg(1).png"
              alt="Planck Logo"
              width={140}
              height={45}
              className="h-10 w-auto"
            />
          </div>
          <nav className="hidden md:flex gap-8">
            <a href="#features" className="text-foreground hover:text-primary transition">
              Features
            </a>
            <a href="#pricing" className="text-foreground hover:text-primary transition">
              Pricing
            </a>
            <a href="#docs" className="text-foreground hover:text-primary transition">
              Docs
            </a>
          </nav>
          <Link href="/auth/login">
            <Button className="bg-primary hover:bg-primary/90 text-lg transition-transform duration-300 hover:scale-105 hover:shadow-xl shadow-primary/30 px-6 py-2.5">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      <div className="pt-24">
        {/* Hero Section */}
        <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 overflow-hidden md:py-32">
          <div className="absolute inset-0 -z-10">
            <HeroAnimation />
          </div>

          <div className="flex flex-col items-center gap-12 relative z-10">
            <div className="text-center space-y-6">
              <h1 className="text-5xl md:text-7xl font-bold text-foreground text-balance">
                Quantum Computing <span className="text-primary">Made Simple</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
                Build and run quantum algorithms without the complexity. Access powerful quantum computing resources
                with an intuitive interface.
              </p>
              <div className="flex gap-4 justify-center flex-wrap pt-4">
                <Link href="/auth/login">
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary/90 text-lg px-8 transition-transform duration-300 hover:scale-105 hover:shadow-xl shadow-primary/30 shadow-xl"
                  >
                    Start Free Trial <ArrowRight className="ml-2" size={20} />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 bg-transparent"
                >
                  Watch Demo
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-4xl font-bold text-foreground mb-12 text-center">Powerful Features</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: "Lightning Fast",
                description: "Run quantum simulations with optimized performance",
              },
              {
                icon: BarChart3,
                title: "Real-time Analytics",
                description: "Monitor and analyze quantum circuit results in real-time",
              },
              {
                icon: Lock,
                title: "Secure & Private",
                description: "Enterprise-grade security for your quantum code",
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

        {/* Computing Evolution Image */}
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

        {/* CTA */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-4xl font-bold text-foreground mb-6">Ready to build quantum?</h2>
          <p className="text-lg text-muted-foreground mb-8">Join developers using Planck to build the quantum future</p>
          <Link href="/auth/login">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-lg px-8 transition-transform duration-300 hover:scale-105 hover:shadow-xl shadow-primary/30 shadow-lg"
            >
              Get Started Now <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </section>

        {/* Footer */}
        <footer className="border-t border-border shadow-sm bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-muted-foreground">
            <p>© 2025 Planck. Building the quantum future.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
