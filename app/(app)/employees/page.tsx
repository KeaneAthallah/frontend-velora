"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { listEmployees } from "@/lib/api/employees";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeesPage() {
  const { data, isLoading } = useQuery({ queryKey: ["employees"], queryFn: listEmployees });
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-semibold mb-3">Employees</h3>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !data || data.length === 0 ? (
          <EmptyState title="No employees" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Email</th><th className="p-2 text-left">Role</th><th className="p-2 text-left">Status</th></tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="p-2 font-medium">{e.name}</td>
                  <td className="p-2 text-muted-foreground">{e.email}</td>
                  <td className="p-2">{e.role}</td>
                  <td className="p-2"><Badge variant={e.active ? "success" : "secondary"}>{e.active ? "Active" : "Inactive"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
