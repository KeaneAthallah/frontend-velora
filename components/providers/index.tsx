"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./theme-provider";
import { AuthProvider } from "@/lib/auth/auth-context";
import { SubscriptionProvider } from "@/lib/subscription/context";
import { BusinessProvider } from "@/lib/business/context";
import { OfflineProvider } from "@/lib/offline/provider";
import { ToastProvider } from "@/components/ui/toast";
import { MockDataToggle } from "@/components/dev/mock-data-toggle";
import { OfflineServiceWorker } from "@/components/offline/service-worker";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      })
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <BusinessProvider>
              <ToastProvider>
                {/* Needs the query client (to invalidate after a sync) and the
                    toast provider (to announce results). */}
                <OfflineProvider>
                  {children}
                  <MockDataToggle />
                  <OfflineServiceWorker />
                </OfflineProvider>
              </ToastProvider>
            </BusinessProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
