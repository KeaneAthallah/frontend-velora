"use client";

import React from "react";
import { PageHeader, Card, Table } from "@/components/ui";
import { formatCurrency } from "@/lib/formatting/currency";

const customers = [
  { id: 1, name: "Andi Pratama", phone: "0812-5550-0101", visits: 24, spent: 1840000, last: "Today" },
  { id: 2, name: "Siti Rahma", phone: "0813-5550-0178", visits: 17, spent: 1260000, last: "Yesterday" },
  { id: 3, name: "Budi Santoso", phone: "0821-5550-0233", visits: 9, spent: 640000, last: "3 days ago" },
  { id: 4, name: "Maya Lestari", phone: "0857-5550-0312", visits: 3, spent: 215000, last: "Last week" },
];

export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Customers" sub={`${customers.length} customers in your loyalty list`}><button className="btn primary">Add customer</button></PageHeader>
      <Card pad={false}>
        <Table cols={["Name", "Phone", "Visits", "Total spent", "Last visit"]}
          rows={customers.map((c) => [<b key="n">{c.name}</b>, c.phone, c.visits, formatCurrency(c.spent), c.last])} />
      </Card>
    </>
  );
}
