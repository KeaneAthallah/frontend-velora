import { apiRequest, USE_MOCK_API } from "./client";
import { mockId } from "./mock-db";

export type InboxNotification = {
  id: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
};

function normalize(raw: any): InboxNotification {
  return {
    id: String(raw.id),
    type: raw.type ?? "system",
    title: raw.title ?? "",
    body: raw.body ?? undefined,
    data: raw.data ?? undefined,
    readAt: raw.read_at ?? undefined,
    createdAt: raw.created_at ?? new Date().toISOString(),
  };
}

export async function listNotifications(params?: {
  unreadOnly?: boolean;
  type?: string;
}): Promise<{ notifications: InboxNotification[]; unreadCount: number }> {
  if (USE_MOCK_API) {
    return {
      notifications: [
        {
          id: mockId("ntf"),
          type: "sale.completed",
          title: "Daily sales summary is ready",
          body: "Yesterday closed 8% above the previous week.",
          createdAt: new Date().toISOString(),
        },
        {
          id: mockId("ntf"),
          type: "inventory.low_stock",
          title: "3 products are running low",
          body: "Review the reorder suggestions before the weekend.",
          createdAt: new Date(Date.now() - 3600_000).toISOString(),
        },
      ],
      unreadCount: 2,
    };
  }

  const query = new URLSearchParams();
  if (params?.unreadOnly) query.set("unread_only", "1");
  if (params?.type) query.set("type", params.type);
  const data = await apiRequest<any>(`/notifications${query.toString() ? `?${query}` : ""}`);
  return {
    notifications: (data?.notifications?.data ?? []).map(normalize),
    unreadCount: Number(data?.unread_count ?? 0),
  };
}

export async function unreadNotificationCount(): Promise<number> {
  if (USE_MOCK_API) return 2;
  const data = await apiRequest<any>("/notifications/unread-count");
  return Number(data?.unread_count ?? 0);
}

export async function markNotificationRead(id: string): Promise<void> {
  if (USE_MOCK_API) return;
  await apiRequest(`/notifications/${id}/read`, { method: "POST" });
}

export async function markAllNotificationsRead(): Promise<void> {
  if (USE_MOCK_API) return;
  await apiRequest("/notifications/read-all", { method: "POST" });
}
