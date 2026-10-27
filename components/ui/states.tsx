"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, RefreshCw, TriangleAlert } from "lucide-react";
import { Alert, Button, EmptyState, Skeleton } from "./primitives";
import { cn } from "@/lib/utils";

export function AccessDenied({
  permission,
  title = "You do not have access to this area",
  description,
}: {
  permission?: string;
  title?: string;
  description?: string;
}) {
  return (
    <div className="stack" style={{ paddingTop: 24 }}>
      <div className="card">
        <EmptyState
          icon={<LockKeyhole aria-hidden="true" />}
          title={title}
          titleLevel="h1"
          description={
            description ??
            "Your role does not include this permission. Ask a workspace owner to update your access if you need it."
          }
          actions={
            <>
              <Link href="/" className="btn btn--secondary">
                <ArrowLeft aria-hidden="true" />
                Back to workspace
              </Link>
              {permission ? (
                <span className="hint">
                  Required permission: <code>{permission}</code>
                </span>
              ) : null}
            </>
          }
        />
      </div>
    </div>
  );
}

export function PageError({
  title = "This page could not load",
  error,
  onRetry,
  className,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "An unexpected error interrupted the request.";
  return (
    <div className={cn("card", className)}>
      <div style={{ padding: 20 }}>
        <Alert tone="danger" title={title}>
          {message}
        </Alert>
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry} style={{ marginTop: 12 }}>
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function InlineError({ title, error, onRetry }: { title: string; error?: unknown; onRetry?: () => void }) {
  return (
    <PageError title={title} error={error} onRetry={onRetry} />
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="stat" key={index}>
          <Skeleton style={{ height: 10, width: "45%", marginBottom: 14 }} />
          <Skeleton style={{ height: 28, width: "70%", marginBottom: 10 }} />
          <Skeleton style={{ height: 9, width: "55%" }} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="stack-sm" style={{ padding: 16 }} aria-busy="true" aria-label="Loading data">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="skeleton-row" style={{ opacity: 1 - index * 0.09 }} />
      ))}
    </div>
  );
}

export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="stack-sm" aria-busy="true" aria-label="Loading section">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="row" style={{ gap: 12 }} key={index}>
          <Skeleton style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0 }} />
          <div className="stack-sm" style={{ gap: 6, flex: 1 }}>
            <Skeleton style={{ height: 11, width: `${48 + index * 7}%` }} />
            <Skeleton style={{ height: 9, width: `${30 + index * 5}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageLoading({ label = "Loading this page" }: { label?: string }) {
  return (
    <div className="stack" style={{ gap: 18 }} aria-busy="true" aria-label={label}>
      <Skeleton style={{ height: 34, width: "min(280px, 55%)" }} />
      <StatGridSkeleton />
      <div className="card">
        <TableSkeleton rows={7} />
      </div>
    </div>
  );
}

export function PermissionNotice({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <Alert tone="warning" title={title}>
      {children ?? <TriangleAlert aria-hidden="true" />}
    </Alert>
  );
}
