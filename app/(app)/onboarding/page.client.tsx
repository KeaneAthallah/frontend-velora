"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/primitives";
import { Card } from "@/components/ui/card";

const steps = [
  {
    title: "Welcome to Velora",
    description:
      "A modern operations dashboard designed for businesses that want to track sales, manage inventory, and grow loyalty.",
  },
  {
    title: "Manage Your Customers",
    description:
      "Add, edit, and view customer records with phone, email, address, and loyalty numbers—all linked to your sales at checkout.",
  },
  {
    title: "Track Inventory & Sales",
    description:
      "Monitor stock levels, view sales history, and track loyalty points earned per customer at every outlet.",
  },
  {
    title: "Analyze Performance",
    description:
      "Review key metrics, conversion rates, and traffic data to make data-driven decisions for your business.",
  },
];

export default function OnboardingPage() {
  const [step, setStep] = React.useState(1);

  const goToStep = (n: number) => setStep(n);

  if (step > steps.length) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Welcome to Velora!</h2>
          <p className="text-muted-foreground mb-6">
            Onboarding complete. You can start managing your business right away.
          </p>
          <Button
            variant="primary"
            onClick={() => setStep(1)}
            style={{ marginTop: 16 }}
          >
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  

  return (
    <Card className="p-8 max-w-md mx-auto">
      <div className="text-center mb-8">
        {step > 1 ? (
          <Button
            variant="quiet"
            onClick={() => goToStep(step - 1)}
          >
            Back
          </Button>
        ) : null}
        <Button
          variant="primary"
          onClick={() => goToStep(step + 1)}
          style={{ marginTop: 8 }}
        >
          {step < steps.length ? "Next" : "Finish"}
        </Button>
      </div>

      <div className="mt-8 space-y-4 text-center">
        {steps.map((s, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center justify-between",
              step - 1 === i && "text-primary"
            )}
          >
            <span>{s.title}</span>
            {step - 1 === i ? (
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M5 12h5l7 7L20 12l-5-5L5 12z" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5 opacity-40"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M5 12h5l7 7L20 12l-5-5L5 12z" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}