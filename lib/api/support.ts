import { apiRequest, USE_MOCK_API } from "./client";
import { mockId } from "./mock-db";

export type SupportTicket = {
  id: string;
  number: string;
  subject: string;
  category: string;
  priority: string;
  status: "open" | "pending" | "resolved" | "closed";
  createdBy?: string;
  assignedTo?: string;
  lastReplyAt?: string;
  createdAt: string;
};

export type SupportMessage = {
  id: string;
  author?: string;
  authorType: "business" | "platform";
  body: string;
  createdAt: string;
};

function normalizeTicket(raw: any): SupportTicket {
  return {
    id: String(raw.id),
    number: raw.number ?? "",
    subject: raw.subject ?? "",
    category: raw.category ?? "general",
    priority: raw.priority ?? "normal",
    status: (raw.status ?? "open") as SupportTicket["status"],
    createdBy: raw.created_by ?? undefined,
    assignedTo: raw.assigned_to ?? undefined,
    lastReplyAt: raw.last_reply_at ?? undefined,
    createdAt: raw.created_at ?? new Date().toISOString(),
  };
}

function normalizeMessage(raw: any): SupportMessage {
  return {
    id: String(raw.id),
    author: raw.author ?? undefined,
    authorType: (raw.author_type ?? "business") as SupportMessage["authorType"],
    body: raw.body ?? "",
    createdAt: raw.created_at ?? new Date().toISOString(),
  };
}

export async function listSupportTickets(): Promise<SupportTicket[]> {
  if (USE_MOCK_API) {
    return [
      {
        id: mockId("tkt"),
        number: "TKT-DEMO1234",
        subject: "Printer stops after the first receipt",
        category: "technical",
        priority: "high",
        status: "pending",
        createdAt: new Date().toISOString(),
        lastReplyAt: new Date().toISOString(),
      },
    ];
  }

  const data = await apiRequest<any>("/support/tickets");
  const rows = data?.data ?? [];
  return rows.map(normalizeTicket);
}

export async function createSupportTicket(input: {
  subject: string;
  body: string;
  category?: string;
  priority?: string;
}): Promise<SupportTicket> {
  if (USE_MOCK_API) {
    return {
      id: mockId("tkt"),
      number: `TKT-${mockId("demo").slice(0, 8).toUpperCase()}`,
      subject: input.subject,
      category: input.category ?? "general",
      priority: input.priority ?? "normal",
      status: "open",
      createdAt: new Date().toISOString(),
    };
  }

  const data = await apiRequest<any>("/support/tickets", {
    method: "POST",
    body: {
      subject: input.subject,
      body: input.body,
      category: input.category,
      priority: input.priority,
    },
  });
  return normalizeTicket(data.ticket);
}

export async function getSupportTicket(
  id: string
): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }> {
  if (USE_MOCK_API) {
    return {
      ticket: (await listSupportTickets())[0],
      messages: [
        {
          id: mockId("msg"),
          author: "You",
          authorType: "business",
          body: "The printer stops after the first receipt.",
          createdAt: new Date().toISOString(),
        },
        {
          id: mockId("msg"),
          author: "Velora support",
          authorType: "platform",
          body: "Please restart the printer and try again.",
          createdAt: new Date().toISOString(),
        },
      ],
    };
  }

  const data = await apiRequest<any>(`/support/tickets/${id}`);
  return {
    ticket: normalizeTicket(data.ticket),
    messages: (data.messages ?? []).map(normalizeMessage),
  };
}

export async function replySupportTicket(id: string, body: string): Promise<SupportMessage> {
  if (USE_MOCK_API) {
    return {
      id: mockId("msg"),
      author: "You",
      authorType: "business",
      body,
      createdAt: new Date().toISOString(),
    };
  }

  const data = await apiRequest<any>(`/support/tickets/${id}/reply`, { method: "POST", body: { body } });
  return normalizeMessage(data.message);
}
