"use client";

import * as React from "react";
import { AlertTriangle, CloudUpload, RefreshCw, Trash2, WifiOff } from "lucide-react";
import { Badge, Button, EmptyState } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useOffline } from "@/lib/offline/provider";
import { queuedSaleTotal } from "@/lib/offline/queue";
import { useAuth } from "@/lib/auth/auth-context";
import { formatCurrency } from "@/lib/formatting/currency";

function formatMoment(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function OfflineStatus() {
  const { online, queued, pending, failed, syncing, lastSyncedAt, lastCacheUse, error, retryAll, retryOne, discard } =
    useOffline();
  const { push } = useToast();
  const { session } = useAuth();
  const currency = session?.business.currency ?? "IDR";
  const [open, setOpen] = React.useState(false);

  const attention = !online || pending > 0 || failed > 0 || syncing;
  if (!attention) return null;

  const label = !online
    ? pending > 0
      ? `Offline · ${pending} queued`
      : "Offline"
    : syncing
      ? "Syncing…"
      : failed > 0
        ? `${failed} refused`
        : `${pending} queued`;

  const tone = !online ? "warning" : failed > 0 ? "danger" : "info";

  return (
    <>
      <button
        type="button"
        className="topbar__status"
        onClick={() => setOpen(true)}
        aria-label={`Offline status: ${label}`}
        title="Offline queue"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          borderRadius: 999,
          border: "1px solid var(--line)",
          background: "var(--surface-2)",
          cursor: "pointer",
        }}
      >
        {online ? <CloudUpload aria-hidden="true" size={14} /> : <WifiOff aria-hidden="true" size={14} />}
        <Badge tone={tone} dot>
          {label}
        </Badge>
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Offline sync"
        description="Sales taken while the API was unreachable wait here and are sent automatically when the connection returns."
        width={520}
        footer={
          <div className="row between" style={{ gap: 10, width: "100%" }}>
            <span className="hint">
              {lastSyncedAt ? `Last sync ${formatMoment(lastSyncedAt)}` : "Nothing synced yet"}
            </span>
            <Button
              variant="primary"
              size="sm"
              loading={syncing}
              disabled={!online || pending + failed === 0}
              onClick={() => void retryAll()}
            >
              <RefreshCw aria-hidden="true" /> Sync now
            </Button>
          </div>
        }
      >
        <div className="stack">
          {error ? (
            <div className="alert alert--warning" role="status">
              <AlertTriangle aria-hidden="true" />
              <div>
                <b>{online ? "The queue is waiting" : "This till is offline"}</b>
                <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
                  {error}
                </p>
              </div>
            </div>
          ) : null}

          {isStaleCache(lastCacheUse) ? (
            <p className="hint" style={{ margin: 0 }}>
              The register is showing data saved at {formatMoment(lastCacheUse)}.
            </p>
          ) : null}

          {queued.length === 0 ? (
            <EmptyState
              compact
              icon={<CloudUpload aria-hidden="true" />}
              title="Nothing waiting"
              description="Every sale taken here has reached the server."
            />
          ) : (
            <div className="record-list">
              {queued.map((entry) => {
                const items = entry.request.items.reduce((sum, item) => sum + item.quantity, 0);
                return (
                  <div className="record" key={entry.id}>
                    <div className="record__top">
                      <div style={{ minWidth: 0 }}>
                        <div className="record__title">
                          {formatCurrency(queuedSaleTotal(entry), currency)}
                          <Badge tone={entry.status === "failed" ? "danger" : "info"}>
                            {entry.status === "failed" ? "refused" : "queued"}
                          </Badge>
                        </div>
                        <div className="record__meta">
                          {formatMoment(entry.createdAt)} · {items} {items === 1 ? "item" : "items"} ·{" "}
                          {(entry.request.paymentMethod ?? "cash").toUpperCase()}
                          {entry.attempts > 1 ? ` · ${entry.attempts} attempts` : ""}
                        </div>
                        {entry.lastError ? (
                          <div className="hint" style={{ marginTop: 4, color: "var(--danger)" }}>
                            {entry.lastError}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="row row-tight" style={{ gap: 8, marginTop: 8 }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={syncing}
                        disabled={!online}
                        onClick={() => void retryOne(entry.id)}
                      >
                        <RefreshCw aria-hidden="true" /> Retry
                      </Button>
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => {
                          void discard(entry.id);
                          push({ title: "Queued sale discarded", variant: "warning" });
                        }}
                      >
                        <Trash2 aria-hidden="true" /> Discard
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="hint" style={{ margin: 0 }}>
            A queued sale keeps the same idempotency key on every attempt, so retrying can never charge the guest twice.
            Refused sales stay here with the server&apos;s reason; discard one only after re-ringing it.
          </p>
        </div>
      </Sheet>
    </>
  );
}

function isStaleCache(value: string | null) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && Date.now() - time < 24 * 60 * 60 * 1000;
}
