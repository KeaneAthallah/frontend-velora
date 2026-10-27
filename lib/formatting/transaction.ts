import type { Transaction } from "@/lib/api/types";

/** The state a cashier or manager actually cares about, combining sale and payment status. */
export function transactionState(transaction: Transaction): string {
  if (transaction.status === "voided") return "voided";
  if (transaction.status === "refunded") return "refunded";
  if (transaction.paymentStatus === "paid") return "paid";
  if (transaction.paymentStatus === "partially_refunded") return "partially_refunded";
  if (transaction.paymentStatus === "failed") return "failed";
  return "pending";
}

export function transactionTone(transaction: Transaction) {
  const state = transactionState(transaction);
  if (state === "paid") return "success" as const;
  if (state === "voided" || state === "failed") return "danger" as const;
  if (state === "pending" || state === "refunded" || state === "partially_refunded") return "warning" as const;
  return "neutral" as const;
}

export function transactionLabel(transaction: Transaction) {
  const state = transactionState(transaction);
  if (state === "paid") return "Paid";
  if (state === "pending") return "Payment pending";
  if (state === "partially_refunded") return "Partially refunded";
  return state.charAt(0).toUpperCase() + state.slice(1);
}

export function itemCount(transaction: Transaction) {
  return transaction.items.reduce((sum, item) => sum + item.quantity, 0);
}
