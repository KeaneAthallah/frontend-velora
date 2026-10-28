"use client";

// Opt out of instant-navigation validation: these pages render data-dependent client UI.
export const instant = false;


import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Ban,
  ChevronRight,
  CreditCard,
  Receipt,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import {
  Badge,
  Button,
  ChipButton,
  EmptyState,
  Field,
  Input,
  PageSizeSelect,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
} from "@/components/ui/primitives";
import { DataTable, Pagination, TablePagination, type Column } from "@/components/ui/table";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { getTransaction, listTransactions, voidTransaction } from "@/lib/api/sales";
import { approveRefund, listRefunds, rejectRefund, requestRefund } from "@/lib/api/payments";
import { paymentMethodLabel } from "@/lib/api/reports";
import type { Payment, Refund, Transaction } from "@/lib/api/types";
import { formatCurrency, formatDateTime, formatNumber, formatTime } from "@/lib/formatting/currency";
import { itemCount, transactionLabel, transactionState, transactionTone } from "@/lib/formatting/transaction";
import { useBusiness } from "@/lib/business/context";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useDebouncedValue, useSearchParamState, replaceSearchParam } from "@/lib/use-debounced";

type StatusFilter = "" | "completed" | "voided" | "refunded";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "voided", label: "Voided" },
  { value: "refunded", label: "Refunded" },
];

export default function TransactionsPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const { outletId, outlet } = useBusiness();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [search, setSearch, searchReady] = useSearchParamState("q");
  const [status, setStatus] = React.useState<StatusFilter>("");
  const [range, setRange] = React.useState("30d");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [voidOpen, setVoidOpen] = React.useState(false);
  const [voidReason, setVoidReason] = React.useState("");
  const [voidError, setVoidError] = React.useState<string | null>(null);
  const [refundPayment, setRefundPayment] = React.useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = React.useState("");
  const [refundReason, setRefundReason] = React.useState("");
  const [refundError, setRefundError] = React.useState<string | null>(null);
  const debounced = useDebouncedValue(search, 300);

  React.useEffect(() => {
    if (!searchReady) return;
    replaceSearchParam("q", debounced.trim());
  }, [debounced, searchReady]);

  React.useEffect(() => {
    setPage(1);
  }, [debounced, status, range, outletId, pageSize]);

  const from = React.useMemo(() => {
    if (range === "all") return undefined;
    const date = new Date();
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    date.setDate(date.getDate() - days + 1);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }, [range]);

  const query = useQuery({
    queryKey: ["transactions", outletId, debounced, status, from, page, pageSize],
    queryFn: () =>
      listTransactions({
        outletId: outletId ?? undefined,
        search: debounced.trim() || undefined,
        status: status || undefined,
        from,
        page,
        pageSize,
      }),
    enabled: has("sales.view") && Boolean(outletId),
    placeholderData: (previous) => previous,
    staleTime: 15_000,
  });

  const detail = useQuery({
    queryKey: ["transaction", selectedId],
    queryFn: () => getTransaction(selectedId!),
    enabled: Boolean(selectedId) && has("sales.view"),
  });

  const refundsQuery = useQuery({
    queryKey: ["refunds", selectedId],
    queryFn: () => listRefunds({ saleId: selectedId!, pageSize: 50 }),
    enabled: Boolean(selectedId) && has("sales.refund"),
    staleTime: 10_000,
  });

  const refunds = refundsQuery.data?.data ?? [];

  const refreshAfterRefund = async () => {
    await queryClient.invalidateQueries({ queryKey: ["refunds", selectedId] });
    await queryClient.invalidateQueries({ queryKey: ["transaction", selectedId] });
    await queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  };

  const refundMutation = useMutation({
    mutationFn: async () => {
      if (!refundPayment) throw new Error("Choose a payment to refund.");
      const amount = Number(refundAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a refund amount greater than zero.");
      }
      return requestRefund(refundPayment.id, {
        amount,
        reason: refundReason.trim() || undefined,
      });
    },
    onSuccess: async (refund) => {
      push({
        title: "Refund requested",
        description: `${formatCurrency(refund.amount, currency)} is pending approval.`,
        variant: "success",
      });
      setRefundPayment(null);
      setRefundAmount("");
      setRefundReason("");
      setRefundError(null);
      await refreshAfterRefund();
    },
    onError: (error) => {
      setRefundError(error instanceof Error ? error.message : "The refund could not be requested.");
    },
  });

  const refundDecision = useMutation({
    mutationFn: ({ refund, action }: { refund: Refund; action: "approve" | "reject" }) =>
      action === "approve" ? approveRefund(refund.id) : rejectRefund(refund.id),
    onSuccess: async (refund, variables) => {
      push({
        title: variables.action === "approve" ? "Refund approved" : "Refund rejected",
        description: `${formatCurrency(refund.amount, currency)} · ${refund.status}.`,
        variant: "success",
      });
      await refreshAfterRefund();
    },
    onError: (error) => {
      push({
        title: "Refund could not be updated",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error",
      });
    },
  });

  const voidMutation = useMutation({
    mutationFn: () => voidTransaction(selectedId!, voidReason.trim()),
    onSuccess: async () => {
      push({
        title: "Sale voided",
        description: "Stock was returned and the receipt is now marked voided.",
        variant: "success",
      });
      setVoidOpen(false);
      setVoidReason("");
      setVoidError(null);
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["transaction", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error) => setVoidError(error instanceof Error ? error.message : "The sale could not be voided"),
  });

  if (!has("sales.view")) {
    return <AccessDenied permission="sales.view" />;
  }

  const rows = query.data?.data ?? [];
  const currency = session?.business.currency ?? "IDR";
  const refundedFor = (paymentId: string) =>
    refunds
      .filter(
        (refund) =>
          refund.paymentId === paymentId &&
          ["pending", "approved", "completed"].includes(refund.status)
      )
      .reduce((sum, refund) => sum + refund.amount, 0);
  const activeFilters = Boolean(debounced.trim()) || Boolean(status) || range !== "30d";

  const columns: Column<Transaction>[] = [
    {
      id: "receipt",
      header: "Receipt",
      sortable: true,
      sortValue: (row) => row.receiptNumber,
      cell: (row) => (
        <div>
          <span className="mono" style={{ fontSize: 12, fontWeight: 650 }}>
            {row.receiptNumber}
          </span>
          <div className="hint" style={{ marginTop: 2 }}>
            {formatDateTime(row.createdAt)}
          </div>
        </div>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 550 }}>{row.customerName || "Walk-in guest"}</div>
          <div className="hint">{row.cashierName || "Cashier"}</div>
        </div>
      ),
    },
    {
      id: "outlet",
      header: "Outlet",
      cell: (row) => <span className="cell-muted">{row.outletName || outlet?.name || "—"}</span>,
    },
    {
      id: "payment",
      header: "Payment",
      cell: (row) => (
        <div className="row row-tight wrap">
          {row.payments.length ? (
            row.payments.map((payment, index) => (
              <Badge key={payment.id || index} tone="neutral">
                <CreditCard aria-hidden="true" style={{ width: 11, height: 11 }} />
                {paymentMethodLabel(payment.method)}
              </Badge>
            ))
          ) : (
            <span className="hint">Not recorded</span>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      sortValue: (row) => transactionState(row),
      cell: (row) => <StatusBadge status={transactionState(row)} label={transactionLabel(row)} />,
    },
    {
      id: "items",
      header: "Items",
      align: "right",
      cell: (row) => <span className="cell-muted num">{itemCount(row)}</span>,
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      sortable: true,
      sortValue: (row) => row.total,
      cell: (row) => (
        <span className="num" style={{ fontWeight: 650 }}>
          {formatCurrency(row.total, currency)}
        </span>
      ),
    },
  ];

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setRange("30d");
  };

  return (
    <>
      <PageHeader
        title="Transactions"
        description={`Receipts for ${outlet?.name ?? "this outlet"}. Search, inspect, and void recorded sales.`}
        actions={
          <Button variant="secondary" onClick={() => query.refetch()} loading={query.isFetching}>
            Refresh
          </Button>
        }
      />

      <Card>
        <div className="toolbar" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <label className="toolbar__search input-affix">
            <Search aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Receipt, customer, cashier, or product"
              aria-label="Search transactions"
            />
            {search ? (
              <button type="button" className="icon-btn" onClick={() => setSearch("")} aria-label="Clear search">
                <X aria-hidden="true" />
              </button>
            ) : null}
          </label>
          <div className="chips" role="group" aria-label="Filter by status">
            {STATUS_OPTIONS.map((option) => (
              <ChipButton
                key={option.value || "all"}
                active={status === option.value}
                onClick={() => setStatus(option.value)}
              >
                {option.label}
              </ChipButton>
            ))}
          </div>
          <div className="spacer" />
          <label className="row row-tight hint" style={{ gap: 6 }}>
            <SlidersHorizontal aria-hidden="true" style={{ width: 13, height: 13 }} />
            Period
            <Select
              className="select input--sm"
              value={range}
              onChange={(event) => setRange(event.target.value)}
              aria-label="Filter by period"
              style={{ width: 120 }}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </Select>
          </label>
          {activeFilters ? (
            <Button variant="quiet" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          ) : null}
        </div>

        {query.isError ? (
          <InlineError title="Transactions could not be loaded" error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowId={(row) => row.id}
            loading={query.isLoading && !query.data}
            onRowClick={(row) => setSelectedId(row.id)}
            minWidth={780}
            empty={
              <EmptyState
                icon={<Receipt aria-hidden="true" />}
                title={activeFilters ? "No receipts match these filters" : "No transactions yet"}
                description={
                  activeFilters
                    ? "Try a shorter search, another status, or a wider period."
                    : "Completed sales will appear here with their payment and inventory effects."
                }
                actions={
                  activeFilters ? (
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : has("sales.create") ? (
                    <Button variant="primary" onClick={() => router.push("/sales")}>
                      Open register
                    </Button>
                  ) : undefined
                }
              />
            }
            mobile={(row) => (
              <button
                type="button"
                className="record"
                onClick={() => setSelectedId(row.id)}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: 0 }}
              >
                <div className="record__top">
                  <div style={{ minWidth: 0 }}>
                    <div className="record__title">
                      <span className="mono" style={{ fontSize: 12 }}>
                        {row.receiptNumber}
                      </span>
                    </div>
                    <div className="record__meta">
                      {row.customerName || "Walk-in guest"} · {formatTime(row.createdAt)}
                    </div>
                    <div className="row row-tight" style={{ marginTop: 5 }}>
                      <Badge tone={transactionTone(row)} dot>
                        {transactionLabel(row)}
                      </Badge>
                      <span className="hint" style={{ margin: 0 }}>
                        {row.payments.map((payment) => paymentMethodLabel(payment.method)).join(", ") || "No payment"}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <b className="num">{formatCurrency(row.total, currency)}</b>
                    <ChevronRight aria-hidden="true" style={{ width: 15, height: 15, marginLeft: "auto", marginTop: 4 }} />
                  </div>
                </div>
              </button>
            )}
            footer={
              <TablePagination>
                <PageSizeSelect value={pageSize} onChange={setPageSize} options={[10, 20, 50]} />
                <Pagination
                  page={query.data?.page ?? page}
                  totalPages={query.data?.totalPages ?? 1}
                  total={query.data?.total ?? 0}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  label="receipts"
                />
              </TablePagination>
            }
          />
        )}
        {query.isFetching && query.data ? (
          <div className="hint" style={{ padding: "0 16px 12px" }}>
            Updating results…
          </div>
        ) : null}
      </Card>

      <Sheet
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title={detail.data?.receiptNumber ?? "Receipt"}
        description={detail.data ? formatDateTime(detail.data.createdAt) : "Loading receipt details…"}
        width={520}
        footer={
          detail.data ? (
            <>
              <span className="hint" style={{ marginRight: "auto" }}>
                {detail.data.status === "completed"
                  ? "Completed sales can be voided by authorised staff."
                  : `This receipt is ${detail.data.status}.`}
              </span>
              {has("sales.void") && detail.data.status === "completed" ? (
                <Button
                  variant="danger-quiet"
                  onClick={() => {
                    setVoidError(null);
                    setVoidOpen(true);
                  }}
                >
                  <Ban aria-hidden="true" />
                  Void sale
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {detail.isError ? (
          <InlineError title="Receipt could not be loaded" error={detail.error} onRetry={() => detail.refetch()} />
        ) : detail.isLoading || !detail.data ? (
          <div className="stack">
            <Skeleton style={{ height: 80 }} />
            <Skeleton style={{ height: 160 }} />
            <Skeleton style={{ height: 90 }} />
          </div>
        ) : (
          <TransactionDetail
            transaction={detail.data}
            currency={currency}
            refunds={refunds}
            refundsLoading={refundsQuery.isLoading}
            canRefund={has("sales.refund")}
            decisionPending={refundDecision.isPending}
            onRequestRefund={(payment) => {
              setRefundError(null);
              setRefundPayment(payment);
              setRefundAmount(String(Math.max(0, payment.amount - refundedFor(payment.id))));
              setRefundReason("");
            }}
            onDecideRefund={(refund, action) => refundDecision.mutate({ refund, action })}
          />
        )}
      </Sheet>

      <Dialog
        open={voidOpen}
        onClose={() => {
          if (!voidMutation.isPending) setVoidOpen(false);
        }}
        title="Void this sale?"
        description="The receipt is kept for the audit trail. Stock is returned and the sale no longer counts toward sales reports."
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setVoidOpen(false)} disabled={voidMutation.isPending}>
              Keep sale
            </Button>
            <Button
              variant="danger"
              loading={voidMutation.isPending}
              disabled={!voidReason.trim()}
              onClick={() => {
                if (!voidReason.trim()) {
                  setVoidError("Add a reason so the void is traceable.");
                  return;
                }
                voidMutation.mutate();
              }}
            >
              Void sale
            </Button>
          </>
        }
      >
        <Field label="Reason" htmlFor="void-reason" required error={voidError}>
          <Textarea
            id="void-reason"
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
            placeholder="For example: duplicate charge, wrong item, customer cancelled"
            rows={3}
            autoFocus
          />
        </Field>
      </Dialog>

      <Dialog
        open={Boolean(refundPayment)}
        onClose={() => {
          if (!refundMutation.isPending) setRefundPayment(null);
        }}
        title="Request a refund"
        description={
          refundPayment
            ? `${paymentMethodLabel(refundPayment.method)} · ${formatCurrency(refundPayment.amount, currency)} captured`
            : undefined
        }
        width={440}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setRefundPayment(null)}
              disabled={refundMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={refundMutation.isPending}
              disabled={!Number(refundAmount)}
              onClick={() => refundMutation.mutate()}
            >
              Request refund
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <Field
            label="Amount"
            htmlFor="refund-amount"
            required
            error={refundError}
            hint={
              refundPayment
                ? `Refundable ${formatCurrency(
                    Math.max(0, refundPayment.amount - refundedFor(refundPayment.id)),
                    currency
                  )}. Pending refunds reserve their amount.`
                : undefined
            }
          >
            <Input
              id="refund-amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={refundAmount}
              onChange={(event) => setRefundAmount(event.target.value)}
              autoFocus
            />
          </Field>
          <Field
            label="Reason"
            htmlFor="refund-reason"
            hint="Shown in the refund queue and kept in the audit trail."
          >
            <Textarea
              id="refund-reason"
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              placeholder="For example: spilled drink, wrong item, duplicate charge"
              rows={3}
            />
          </Field>
          <div className="alert alert--info">
            Refunds start as pending. Approving one marks the payment and sale as
            partially or fully refunded; rejecting it releases the reserved amount.
          </div>
        </div>
      </Dialog>
    </>
  );
}

function TransactionDetail({
  transaction,
  currency,
  refunds,
  refundsLoading,
  canRefund,
  decisionPending,
  onRequestRefund,
  onDecideRefund,
}: {
  transaction: Transaction;
  currency: string;
  refunds: Refund[];
  refundsLoading: boolean;
  canRefund: boolean;
  decisionPending: boolean;
  onRequestRefund: (payment: Payment) => void;
  onDecideRefund: (refund: Refund, action: "approve" | "reject") => void;
}) {
  const refundedFor = (paymentId: string) =>
    refunds
      .filter(
        (refund) =>
          refund.paymentId === paymentId &&
          ["pending", "approved", "completed"].includes(refund.status)
      )
      .reduce((sum, refund) => sum + refund.amount, 0);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="row between wrap">
        <div>
          <div className="hint">Customer</div>
          <div style={{ fontWeight: 600 }}>{transaction.customerName || "Walk-in guest"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="hint">Total</div>
          <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>
            {formatCurrency(transaction.total, currency)}
          </div>
        </div>
      </div>

      <div className="row row-tight wrap">
        <StatusBadge status={transactionState(transaction)} label={transactionLabel(transaction)} />
        <Badge tone="neutral">{transaction.outletName || "Outlet"}</Badge>
        <Badge tone="neutral">Cashier: {transaction.cashierName || "—"}</Badge>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Items
        </div>
        <div className="card" style={{ boxShadow: "none" }}>
          <div className="record-list">
            {transaction.items.map((item, index) => (
              <div className="record" key={`${item.productId ?? item.name}-${index}`}>
                <div className="record__top">
                  <div style={{ minWidth: 0 }}>
                    <div className="record__title">{item.name}</div>
                    <div className="record__meta">
                      {item.sku || "No SKU"} · {formatCurrency(item.unitPrice, currency)} each
                      {item.discount ? ` · ${formatCurrency(item.discount, currency)} off` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <b className="num">{formatCurrency(item.lineTotal, currency)}</b>
                    <div className="hint">× {item.quantity}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <dl className="ledger">
        <div className="ledger__row">
          <dt>Subtotal</dt>
          <dd className="num">{formatCurrency(transaction.subtotal, currency)}</dd>
        </div>
        {transaction.discount ? (
          <div className="ledger__row">
            <dt>Discount</dt>
            <dd className="num">−{formatCurrency(transaction.discount, currency)}</dd>
          </div>
        ) : null}
        {transaction.promotionDiscount ? (
          <div className="ledger__row">
            <dt>
              Promotion
              {transaction.promotionCode ? <span className="hint"> · {transaction.promotionCode}</span> : null}
            </dt>
            <dd className="num">−{formatCurrency(transaction.promotionDiscount, currency)}</dd>
          </div>
        ) : null}
        {transaction.loyaltyDiscount ? (
          <div className="ledger__row">
            <dt>
              Loyalty points
              {transaction.loyaltyPointsRedeemed
                ? ` · ${formatNumber(transaction.loyaltyPointsRedeemed)} redeemed`
                : ""}
            </dt>
            <dd className="num">−{formatCurrency(transaction.loyaltyDiscount, currency)}</dd>
          </div>
        ) : null}
        <div className="ledger__row">
          <dt>Tax</dt>
          <dd className="num">{formatCurrency(transaction.tax, currency)}</dd>
        </div>
        <div className="ledger__row ledger__row--total">
          <dt>Total</dt>
          <dd className="num">{formatCurrency(transaction.total, currency)}</dd>
        </div>
      </dl>

      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Payments
        </div>
        {transaction.payments.length ? (
          <div className="stack-sm">
            {transaction.payments.map((payment) => {
              const refundable = Math.max(0, payment.amount - refundedFor(payment.id));
              return (
                <div className="stack-sm" key={payment.id}>
                  <div className="row between" style={{ fontSize: 12.5 }}>
                    <span>
                      {paymentMethodLabel(payment.method)}
                      {payment.reference ? <span className="hint"> · {payment.reference}</span> : null}
                    </span>
                    <span className="row row-tight">
                      <StatusBadge status={payment.status} />
                      <b className="num">{formatCurrency(payment.amount, currency)}</b>
                    </span>
                  </div>
                  {canRefund && refundable > 0.005 && payment.status !== "failed" ? (
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <Button variant="quiet" size="sm" onClick={() => onRequestRefund(payment)}>
                        Refund
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="hint">No payment was recorded against this receipt.</p>
        )}
      </div>

      {canRefund ? (
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Refunds
          </div>
          {refundsLoading ? (
            <p className="hint">Loading refunds…</p>
          ) : refunds.length ? (
            <div className="stack-sm">
              {refunds.map((refund) => (
                <div
                  key={refund.id}
                  className="stack-sm"
                  style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, padding: 10 }}
                >
                  <div className="row between wrap" style={{ gap: 8 }}>
                    <span>
                      <b className="num">{formatCurrency(refund.amount, currency)}</b>
                      <span className="hint">
                        {" "}
                        · {refund.payment ? paymentMethodLabel(refund.payment.method) : "Payment"}
                      </span>
                    </span>
                    <Badge
                      tone={
                        refund.status === "completed"
                          ? "success"
                          : refund.status === "pending"
                            ? "warning"
                            : refund.status === "rejected"
                              ? "danger"
                              : "neutral"
                      }
                      dot
                    >
                      {refund.status}
                    </Badge>
                  </div>
                  {refund.reason ? (
                    <p className="hint" style={{ margin: 0 }}>
                      {refund.reason}
                    </p>
                  ) : null}
                  <div className="row between wrap" style={{ gap: 8 }}>
                    <span className="hint">{formatDateTime(refund.createdAt)}</span>
                    {refund.status === "pending" ? (
                      <span className="row row-tight">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={decisionPending}
                          onClick={() => onDecideRefund(refund, "reject")}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={decisionPending}
                          onClick={() => onDecideRefund(refund, "approve")}
                        >
                          Approve
                        </Button>
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="hint">No refunds for this receipt.</p>
          )}
        </div>
      ) : null}

      {transaction.notes ? (
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Notes
          </div>
          <p style={{ fontSize: 12.5, color: "hsl(var(--ink-2))", whiteSpace: "pre-wrap" }}>{transaction.notes}</p>
        </div>
      ) : null}
    </div>
  );
}
