"use client";

export const instant = false;

import { InvoiceList } from "@/components/finance/invoice-list";

export default function ReceivablesPage() {
  return <InvoiceList kind="ar" />;
}
