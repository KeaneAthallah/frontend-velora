"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./theme-provider";
import { AuthProvider } from "@/lib/auth/auth-context";
import { BusinessProvider } from "@/lib/business/context";
import { ToastProvider } from "@/components/ui/toast";
import { MockDataToggle } from "@/components/dev/mock-data-toggle";

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
          <BusinessProvider>
            <ToastProvider>
              {children}
              <MockDataToggle />
            </ToastProvider>
          </BusinessProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
