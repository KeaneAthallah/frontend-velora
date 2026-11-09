"use client";

export const instant = false;

import { InvoiceList } from "@/components/finance/invoice-list";

export default function PayablesPage() {
  return <InvoiceList kind="ap" />;
}
