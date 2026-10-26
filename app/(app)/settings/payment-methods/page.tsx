"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { listPaymentMethods } from "@/lib/api/business";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function PaymentMethodsSettingsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["payment-methods"], queryFn: listPaymentMethods });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold">Payment methods</h3>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : !data || data.length === 0 ? (
          <EmptyState title="No payment methods" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Type</th><th className="p-2 text-left">Status</th></tr>
            </thead>
            <tbody>
              {data.map((pm) => (
                <tr key={pm.id} className="border-b last:border-0">
                  <td className="p-2 font-medium">{pm.name}</td>
                  <td className="p-2 text-muted-foreground">{pm.type}</td>
                  <td className="p-2"><Badge variant={pm.active ? "success" : "secondary"}>{pm.active ? "Active" : "Inactive"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-muted-foreground">Managed by backend. Frontend reflects configured methods only.</p>
      </CardContent>
    </Card>
  );
}
