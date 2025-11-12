import { MainLayout } from "@/components/layout/main-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

const plans = [
  {
    name: "Starter",
    price: "$29",
    period: "/month",
    description: "Perfect for learning",
    features: ["1,000 circuit runs/month", "Up to 8 qubits", "Community support", "Basic analytics"],
    current: false,
  },
  {
    name: "Professional",
    price: "$99",
    period: "/month",
    description: "For active researchers",
    features: [
      "50,000 circuit runs/month",
      "Up to 20 qubits",
      "Priority support",
      "Advanced analytics",
      "Custom templates",
    ],
    current: true,
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "pricing",
    description: "For large teams",
    features: [
      "Unlimited circuit runs",
      "Up to 100 qubits",
      "Dedicated support",
      "Advanced analytics",
      "Custom templates",
      "SSO & security",
    ],
    current: false,
  },
]

export default function BillingPage() {
  return (
    <MainLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Billing & Plans</h1>
          <p className="text-muted-foreground">Choose the right plan for your quantum computing needs.</p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <Card
              key={i}
              className={`p-6 flex flex-col transition ${
                plan.highlighted ? "border-primary/50 border-2 shadow-lg shadow-primary/20" : ""
              }`}
            >
              <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
              <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-primary">{plan.price}</span>
                <span className="text-muted-foreground text-sm ml-2">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-6 flex-grow">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <Check className="text-primary flex-shrink-0 mt-0.5" size={18} />
                    <span className="text-foreground text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={`w-full ${
                  plan.highlighted ? "bg-primary hover:bg-primary/90 text-primary-foreground" : 'variant="outline'
                }`}
              >
                {plan.current ? "Current Plan" : "Choose Plan"}
              </Button>
            </Card>
          ))}
        </div>

        {/* Billing History */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold text-foreground mb-6">Billing History</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Date</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Description</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Amount</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border hover:bg-secondary/50 transition">
                  <td className="py-3 px-4 text-foreground">Nov 1, 2024</td>
                  <td className="py-3 px-4 text-foreground">Professional Plan - Monthly</td>
                  <td className="py-3 px-4 text-foreground">$99.00</td>
                  <td className="py-3 px-4">
                    <span className="inline-block px-3 py-1 rounded-full text-sm bg-primary/20 text-primary">Paid</span>
                  </td>
                </tr>
                <tr className="border-b border-border hover:bg-secondary/50 transition">
                  <td className="py-3 px-4 text-foreground">Oct 1, 2024</td>
                  <td className="py-3 px-4 text-foreground">Professional Plan - Monthly</td>
                  <td className="py-3 px-4">$99.00</td>
                  <td className="py-3 px-4">
                    <span className="inline-block px-3 py-1 rounded-full text-sm bg-primary/20 text-primary">Paid</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </MainLayout>
  )
}
