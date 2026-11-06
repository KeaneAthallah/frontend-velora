"use client";

export const instant = false;

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Button, EmptyState } from "@/components/ui/primitives";
import { InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
import { formatDateTime } from "@/lib/formatting/currency";

export default function NotificationsPage() {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = React.useState(false);

  const inbox = useQuery({
    queryKey: ["notifications", unreadOnly],
    queryFn: () => listNotifications({ unreadOnly }),
  });

  const read = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      push({ title: "Inbox cleared", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const rows = inbox.data?.notifications ?? [];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Sales, stock, support replies and platform announcements for your account."
        actions={
          <div className="row" style={{ gap: 8 }}>
            <Button size="sm" variant="quiet" onClick={() => setUnreadOnly((value) => !value)}>
              {unreadOnly ? "Show all" : "Unread only"}
            </Button>
            <Button size="sm" onClick={() => readAll.mutate()} loading={readAll.isPending}>
              <CheckCheck aria-hidden="true" /> Mark all read
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader
          title={unreadOnly ? "Unread" : "All notifications"}
          description={`${inbox.data?.unreadCount ?? 0} unread`}
        />
        <CardBody>
          {inbox.isError ? (
            <InlineError title="Could not load notifications" error={inbox.error} onRetry={() => inbox.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState icon={<Bell aria-hidden="true" />} title="You are all caught up" description="New activity will appear here." />
          ) : (
            <div className="stack-sm">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="row"
                  style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start", paddingBottom: 10, borderBottom: "1px solid hsl(var(--border))" }}
                >
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <strong>{row.title}</strong>
                      {!row.readAt ? <Badge tone="info">New</Badge> : null}
                    </div>
                    {row.body ? <p className="hint" style={{ margin: "2px 0" }}>{row.body}</p> : null}
                    <span className="hint">{formatDateTime(row.createdAt)} · {row.type}</span>
                  </div>
                  {!row.readAt ? (
                    <Button size="sm" variant="quiet" onClick={() => read.mutate(row.id)} loading={read.isPending}>
                      Mark read
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
