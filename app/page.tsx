"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, Zap, BarChart3, Lock } from "lucide-react"
import { PricingSection } from "@/components/pricing-section"
import { AnimatedBackground } from "@/components/animated-background"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Image src="/planck-logo.jpg" alt="Planck Logo" width={120} height={40} className="h-10 w-auto" />
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
          <Link href="/qsaas/dashboard">
            <Button className="bg-primary hover:bg-primary/90">Get Started</Button>
          </Link>
        </div>
      </header>

      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 overflow-hidden">
        <div className="absolute inset-0 h-full -z-10">
          <AnimatedBackground />
        </div>
        <div className="flex flex-col items-center gap-12 relative z-10">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 text-balance">
              Quantum Computing <span className="text-primary">Made Simple</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-balance">
              Build and run quantum algorithms without the complexity. Access powerful quantum computing resources with
              an intuitive interface.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/qsaas/dashboard">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-lg px-8">
                  Start Free Trial <ArrowRight className="ml-2" size={20} />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-lg px-8 bg-transparent">
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
              <div key={i} className="bg-card border border-border rounded-lg p-8 hover:shadow-lg transition">
                <Icon className="text-primary mb-4" size={32} />
                <h3 className="text-xl font-bold text-card-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center">
          <Image
            src="/computing-evolution.jpg"
            alt="Computing Evolution"
            width={600}
            height={180}
            className="rounded-lg shadow-lg"
          />
        </div>
      </section>

      <PricingSection />

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-4xl font-bold text-foreground mb-6">Ready to build quantum?</h2>
        <p className="text-lg text-muted-foreground mb-8">Join developers using Planck to build the quantum future</p>
        <Link href="/qsaas/dashboard">
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-lg px-8">
            Get Started Now <ArrowRight className="ml-2" size={20} />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-muted-foreground">
          <p>© 2025 Planck. Building the quantum future.</p>
        </div>
      </footer>
    </div>
  )
}
