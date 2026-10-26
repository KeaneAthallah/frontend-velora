"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { listSuppliers } from "@/lib/api/purchasing";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function SuppliersPage() {
  const { data, isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: listSuppliers });
  return (
    <Card><CardContent className="p-4">
      <h3 className="font-semibold mb-3">Suppliers</h3>
      {isLoading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        : !data || data.length === 0 ? <EmptyState title="No suppliers" />
        : <table className="w-full text-sm">
            <thead className="border-b"><tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Contact</th><th className="p-2 text-left">Email</th><th className="p-2 text-left">Phone</th></tr></thead>
            <tbody>{data.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="p-2 font-medium">{s.name}</td><td className="p-2">{s.contact}</td><td className="p-2 text-muted-foreground">{s.email}</td><td className="p-2">{s.phone}</td>
              </tr>
            ))}</tbody>
          </table>}
    </CardContent></Card>
  );
}
