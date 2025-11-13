"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

const plans = [
  {
    name: "Explorer",
    price: "$29",
    period: "/month",
    description: "Perfect for getting started",
    features: [
      "Up to 100 quantum circuits/month",
      "Access to quantum simulators",
      "1,000 qubits maximum",
      "Email support",
      "Basic analytics",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Creator",
    price: "$99",
    period: "/month",
    description: "For active quantum researchers",
    features: [
      "Unlimited quantum circuits",
      "GPU-accelerated simulators",
      "10,000 qubits maximum",
      "Priority email & chat support",
      "Advanced analytics & exports",
      "Custom error mitigation",
      "API access",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "pricing",
    description: "For organizations at scale",
    features: [
      "Unlimited everything",
      "Quantum QPU access",
      "Dedicated account manager",
      "Custom integrations",
      "24/7 priority support",
      "On-premise deployment",
      "SLA guarantees",
    ],
    cta: "Contact Sales",
    popular: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-foreground mb-4">Simple, Transparent Pricing</h2>
        <p className="text-xl text-muted-foreground">Choose the plan that fits your quantum computing needs</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {plans.map((plan, index) => (
          <div
            key={index}
            className={`rounded-xl border p-8 transition-all duration-300 hover:scale-105 shadow-lg bg-secondary ${
              plan.popular
                ? "border-primary bg-card shadow-xl shadow-primary/20 scale-105"
                : "border-border bg-card shadow-lg hover:shadow-xl"
            }`}
          >
            {plan.popular && (
              <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold inline-block mb-4">
                Most Popular
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
              <p className="text-muted-foreground text-sm">{plan.description}</p>
            </div>

            <div className="mb-6">
              <span className="text-5xl font-bold text-foreground">{plan.price}</span>
              <span className="text-muted-foreground ml-2">{plan.period}</span>
            </div>

            <Link href="/auth/login" className="block mb-6">
              <Button
                className={`w-full transition-all duration-300 hover:scale-105 shadow-lg ${
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
