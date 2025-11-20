"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Check } from 'lucide-react'

const plans = [
  {
    name: "Free",
    price: "€0",
    period: "/month",
    description: "For those starting the journey",
    features: [
      "Quantum-inspired executions",
      "Up to 12 qubits",
      "Pre-built circuits",
      "Basic analytics",
      "Community support",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Pro",
    price: "€49",
    period: "/month",
    description: "For professionals and teams",
    features: [
      "All Free features",
      "QPU access (limited)",
      "Up to 56 qubits",
      "Custom circuits",
      "Advanced analytics",
      "Priority support",
      "Error mitigation",
      "API access",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Custom",
    price: "Custom",
    period: "",
    description: "Enterprise quantum solutions",
    features: [
      "All Pro features",
      "Unlimited QPU access",
      "Personalized quantum circuits",
      "Priority queue execution",
      "Advanced configuration settings",
      "Dedicated account manager",
      "Custom integrations",
      "Consulting & training",
    ],
    cta: "Contact Sales",
    popular: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold text-foreground mb-4">Pricing</h2>
        <p className="text-xl text-muted-foreground">Choose the plan that fits your computing needs</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan, index) => (
          <div
            key={index}
            className={`rounded-xl border p-8 transition-shadow duration-300 shadow-lg bg-card ${
              plan.popular
                ? "border-primary shadow-xl shadow-primary/20"
                : "border-border shadow-lg hover:shadow-xl"
            }`}
          >
            {plan.popular && (
              <div className="mb-4 -mt-2">
                <span className="inline-block bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold">
                  Best Value
                </span>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
              <p className="text-muted-foreground text-sm">{plan.description}</p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold text-foreground">{plan.price}</span>
              {plan.period && <span className="text-muted-foreground ml-2">{plan.period}</span>}
            </div>

            <Link href="/auth/login" className="block mb-6">
              <Button
                className={`w-full transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg ${
                  plan.popular ? "bg-primary hover:bg-primary/90" : "bg-primary/20 hover:bg-primary/30 text-primary"
                }`}
              >
                {plan.cta}
              </Button>
            </Link>

            <div className="space-y-3">
              {plan.features.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check className="text-primary flex-shrink-0 mt-1" size={18} />
                  <span className="text-foreground text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
