"use client";

import * as React from "react";
import { USE_MOCK_API } from "@/lib/api/client";

type MockMode = "demo" | "worst";

/**
 * Development-only fixture switcher. It is deliberately plain chrome: it
 * never ships in production and never touches the real API.
 */
export function MockDataToggle() {
  const [mounted, setMounted] = React.useState(false);
  const [mode, setMode] = React.useState<MockMode>("demo");

  React.useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    setMode(params.get("data") === "worst" ? "worst" : "demo");
  }, []);

  if (!mounted || process.env.NODE_ENV === "production" || !USE_MOCK_API) return null;

  const choose = (next: MockMode) => {
    const url = new URL(window.location.href);
    if (next === "worst") url.searchParams.set("data", "worst");
    else url.searchParams.delete("data");
    window.location.assign(url.toString());
  };

  return (
    <div className="dev-data-toggle" role="group" aria-label="Mock data fixture">
      <span className="dev-data-toggle__label" aria-hidden="true">
        Fixture
      </span>
      {(["demo", "worst"] as const).map((value) => (
        <button
          key={value}
          type="button"
          className="dev-data-toggle__option"
          aria-pressed={mode === value}
          onClick={() => choose(value)}
        >
          {value === "demo" ? "Demo data" : "Worst case"}
        </button>
      ))}
    </div>
  );
}
