"use client";

export const instant = false;

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Plus, Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Button, EmptyState, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  createSupportTicket,
  getSupportTicket,
  listSupportTickets,
  replySupportTicket,
  type SupportTicket,
} from "@/lib/api/support";
import { usePermissions } from "@/lib/auth/auth-context";
import { formatDateTime } from "@/lib/formatting/currency";

export default function SupportPage() {
  const { has } = usePermissions();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [category, setCategory] = React.useState("general");
  const [priority, setPriority] = React.useState("normal");
  const [reply, setReply] = React.useState("");

  const tickets = useQuery({
    queryKey: ["support", "tickets"],
    queryFn: listSupportTickets,
    enabled: has("support.view"),
  });
  const detail = useQuery({
    queryKey: ["support", "ticket", activeId],
    queryFn: () => getSupportTicket(activeId as string),
    enabled: Boolean(activeId) && has("support.view"),
  });

  const create = useMutation({
    mutationFn: () => createSupportTicket({ subject, body, category, priority }),
    onSuccess: (ticket) => {
      push({ title: "Ticket created", description: ticket.number, variant: "success" });
      setSubject("");
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["support", "tickets"] });
    },
    onError: (error) => push({ title: "Could not create the ticket", description: String(error), variant: "error" }),
  });

  const send = useMutation({
    mutationFn: () => replySupportTicket(activeId as string, reply),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["support", "ticket", activeId] });
      queryClient.invalidateQueries({ queryKey: ["support", "tickets"] });
    },
    onError: (error) => push({ title: "Could not send the reply", description: String(error), variant: "error" }),
  });

  if (!has("support.view")) {
    return <AccessDenied permission="support.view" />;
  }

  const canManage = has("support.manage");
  const rows = tickets.data ?? [];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Help"
        title="Support"
        description="Raise an issue with the Velora team and follow the conversation."
      />

      {canManage ? (
        <Card>
          <CardHeader title="New ticket" description="Include what you were doing and what went wrong." />
          <CardBody>
            <form
              className="stack-sm"
              onSubmit={(event) => {
                event.preventDefault();
                if (subject.trim() && body.trim()) create.mutate();
              }}
            >
              <Field label="Subject" htmlFor="ticket-subject" required>
                <Input id="ticket-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
              </Field>
              <div className="row" style={{ gap: 10 }}>
                <Field label="Category" htmlFor="ticket-category">
                  <Select id="ticket-category" value={category} onChange={(event) => setCategory(event.target.value)}>
                    {["general", "billing", "technical", "account", "feature", "other"].map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Priority" htmlFor="ticket-priority">
                  <Select id="ticket-priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
                    {["low", "normal", "high", "urgent"].map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Describe the issue" htmlFor="ticket-body" required>
                <Textarea id="ticket-body" rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
              </Field>
              <Button type="submit" variant="primary" loading={create.isPending} disabled={!subject.trim() || !body.trim()}>
                <Plus aria-hidden="true" /> Submit ticket
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Tickets" description={`${rows.length} ticket${rows.length === 1 ? "" : "s"}`} />
        <CardBody>
          {tickets.isError ? (
            <InlineError title="Could not load tickets" error={tickets.error} onRetry={() => tickets.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState icon={<LifeBuoy aria-hidden="true" />} title="No tickets" description="Open one above if something is not working." />
          ) : (
            <div className="stack-sm">
              {rows.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className="row"
                  style={{ justifyContent: "space-between", width: "100%", textAlign: "left", gap: 12, background: "none", border: "none", padding: "8px 0", cursor: "pointer" }}
                  onClick={() => setActiveId(ticket.id)}
                >
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <strong>{ticket.subject}</strong>
                      <TicketBadge ticket={ticket} />
                    </div>
                    <div className="hint">{ticket.number} · {ticket.category} · {formatDateTime(ticket.lastReplyAt ?? ticket.createdAt)}</div>
                  </div>
                  <span className="hint">Open</span>
                </button>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Sheet
        open={Boolean(activeId)}
        onClose={() => setActiveId(null)}
        title={detail.data?.ticket.subject ?? "Ticket"}
        description={detail.data ? `${detail.data.ticket.number} · ${detail.data.ticket.status}` : undefined}
      >
        <div className="stack-sm">
          {detail.isError ? <InlineError title="Could not load the ticket" error={detail.error} onRetry={() => detail.refetch()} /> : null}
          {(detail.data?.messages ?? []).map((message) => (
            <div key={message.id} className="record" style={{ padding: 10 }}>
              <div className="record__top">
                <strong>{message.author ?? (message.authorType === "platform" ? "Velora support" : "You")}</strong>
                <span className="hint">{formatDateTime(message.createdAt)}</span>
              </div>
              <p style={{ margin: "6px 0 0" }}>{message.body}</p>
            </div>
          ))}
          {canManage && detail.data && !["closed", "resolved"].includes(detail.data.ticket.status) ? (
            <form
              className="stack-sm"
              onSubmit={(event) => {
                event.preventDefault();
                if (reply.trim()) send.mutate();
              }}
            >
              <Field label="Reply" htmlFor="ticket-reply">
                <Textarea id="ticket-reply" rows={3} value={reply} onChange={(event) => setReply(event.target.value)} />
              </Field>
              <Button type="submit" variant="primary" loading={send.isPending} disabled={!reply.trim()}>
                <Send aria-hidden="true" /> Send reply
              </Button>
            </form>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}

function TicketBadge({ ticket }: { ticket: SupportTicket }) {
  const tone = ticket.status === "open" ? "info" : ticket.status === "pending" ? "warning" : ticket.status === "closed" ? "neutral" : "success";
  return <Badge tone={tone}>{ticket.status}</Badge>;
}
