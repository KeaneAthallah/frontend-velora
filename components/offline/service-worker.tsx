"use client";

import * as React from "react";

/**
 * Registers the offline shell worker.
 *
 * Development is skipped on purpose: a worker caching hashed dev chunks breaks
 * hot reload, and the offline data layer (queue + cached catalogue) is what the
 * register actually depends on.
 */
export function OfflineServiceWorker() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
