"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Package, ShoppingCart, Users } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { Card } from "@/components/ui/card";

const features = [
  {
    title: "Track Sales",
    description:
      "Record sales at checkout, review history, and monitor revenue across all your outlets in real time.",
    href: "/sales",
    icon: <ShoppingCart className="h-5 w-5" />,
  },
  {
    title: "Manage Inventory",
    description:
      "Add products, track stock levels, and set minimum alerts so you know when to restock.",
    href: "/inventory",
    icon: <Package className="h-5 w-5" />,
  },
  {
    title: "Know Your Customers",
    description:
      "Keep customer records with phone, email, address, and loyalty numbers linked to every sale.",
    href: "/customers",
    icon: <Users className="h-5 w-5" />,
  },
];

export default function WelcomePage() {
  const [year, setYear] = React.useState(2026);

  React.useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-color">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-accent-primary flex items-center justify-center text-white font-bold text-lg">
              V
            </div>
            <span className="text-text-primary font-semibold text-lg">Velora</span>
          </div>
          <Link href="/login">
            <Button variant="secondary" size="sm">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent-primary/10 rounded-full text-accent-primary text-sm font-medium mb-6">
            <Package className="h-4 w-4" />
            Modern POS for growing businesses
          </div>
          <h1 className="text-4xl font-bold text-text-primary mb-4 leading-tight">
            Run your business from one place.
          </h1>
          <p className="text-text-secondary text-lg mb-8 max-w-lg mx-auto">
            Track sales, manage inventory, and grow customer loyalty — without
            switching between a dozen tools.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-12">
            <Link href="/login" className="inline-block">
              <Button variant="primary" size="lg">
                Get Started
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard" className="inline-block">
              <Button variant="secondary" size="lg">
                View Demo
              </Button>
            </Link>
          </div>

          {/* Feature cards */}
          <div className="grid sm:grid-cols-3 gap-4">
            {features.map((f) => (
              <Link key={f.title} href={f.href} className="block">
                <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer h-full">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-bg-tertiary flex items-center justify-center text-text-secondary shrink-0">
                      {f.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-text-primary mb-1">
                        {f.title}
                      </h3>
                      <p className="text-sm text-text-secondary">
                        {f.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-color bg-bg-secondary py-6">
        <div className="max-w-5xl mx-auto px-6 text-center text-sm text-text-secondary">
          © {year} Velora. Built for businesses that want to
          move faster.
        </div>
      </footer>
    </div>
  );
}
