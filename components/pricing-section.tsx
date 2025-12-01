"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

const plans = [
  {
    name: "Starter",
    price: "€0",
    period: "/month",
    description: "For those beginning the journey",
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
      "QPUs and quantum-inspired",
      "Up to 36 qubits",
      "Pre-built circuits",
      "Advanced analytics",
      "Priority support",
      "Error mitigation",
      "API access",
    ],
    cta: "Available soon...",
    popular: false,
  },
  {
    name: "Custom",
    price: "Custom",
    period: "",
    description: "Enterprise quantum solutions",
    features: [
      "QPUs and quantum-inspired",
      "Up to 36 qubits",
      "Custom circuits",
      "Custom analytics",
      "Priority support",
      "Error mitigation",
      "API access",
      "Queue priority",
      "Team education",
    ],
    cta: "Contact Us",
    popular: false,
  },
]

export function PricingSection() {
  const contactEmail = "hello@plancktechnologies.xyz"
  const emailSubject = "Enterprise Quantum Solutions Inquiry"
  const emailBody = `Hello Planck Technologies Team,

I am interested in learning more about your Custom enterprise quantum solutions.

Please provide additional information about:
- Custom circuit development
- Team education programs
- Pricing and implementation timeline

Best regards,`

  const mailtoLink = `mailto:${contactEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`

  return (
    <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold text-foreground mb-4">Pricing</h2>
        <p className="text-xl text-muted-foreground">Choose the plan that fits your computing needs</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto opacity-100">
        {plans.map((plan, index) => {
          const isStarter = plan.name === "Starter"
          const isPro = plan.name === "Pro"
          const isCustom = plan.name === "Custom"

          return (
            <div
              key={index}
              className={`rounded-xl border p-8 transition-shadow duration-300 shadow-lg bg-card ${
                plan.popular ? "border-primary shadow-xl shadow-primary/20" : "border-border shadow-lg hover:shadow-xl"
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

              <div className="block mb-6">
                {isStarter ? (
                  <Link href="/auth/login">
                    <Button className="w-full transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg bg-primary/20 hover:bg-primary/30 text-primary">
                      {plan.cta}
                    </Button>
                  </Link>
                ) : isPro ? (
                  <Button
                    disabled
                    className="w-full transition-all duration-300 opacity-50 cursor-not-allowed shadow-lg bg-primary/20 text-primary"
                  >
                    {plan.cta}
                  </Button>
                ) : isCustom ? (
                  <a href={mailtoLink} className="block">
                    <Button className="w-full transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg bg-primary/20 hover:bg-primary/30 text-primary">
                      {plan.cta}
                    </Button>
                  </a>
                ) : null}
              </div>

              <div className="space-y-3">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Check className="text-primary flex-shrink-0 mt-1" size={18} />
                    <span className="text-foreground text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
