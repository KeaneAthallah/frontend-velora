import { apiRequest, USE_MOCK_API } from "./client";
import { mockId } from "./mock-db";

export type DocumentRecord = {
  id: string;
  name: string;
  type: string;
  mimeType?: string;
  size: number;
  description?: string;
  uploadedBy?: string;
  createdAt: string;
  downloadUrl: string;
};

export const DOCUMENT_TYPES = ["general", "receipt", "invoice", "contract", "report", "identity", "other"];

export async function listDocuments(params?: { type?: string; q?: string }): Promise<DocumentRecord[]> {
  if (USE_MOCK_API) {
    return [
      {
        id: mockId("doc"),
        name: "Supplier agreement 2026.pdf",
        type: "contract",
        mimeType: "application/pdf",
        size: 348_000,
        uploadedBy: "Demo owner",
        createdAt: new Date().toISOString(),
        downloadUrl: "#",
      },
    ];
  }

  const query = new URLSearchParams();
  if (params?.type) query.set("type", params.type);
  if (params?.q) query.set("q", params.q);
  const data = await apiRequest<any>(`/documents${query.toString() ? `?${query}` : ""}`);
  const rows = data?.data ?? [];
  return rows.map((row: any) => ({
    id: String(row.id),
    name: row.name ?? "",
    type: row.type ?? "general",
    mimeType: row.mime_type ?? undefined,
    size: Number(row.size ?? 0),
    description: row.description ?? undefined,
    uploadedBy: row.uploaded_by ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
    downloadUrl: row.download_url ?? "",
  }));
}

export async function uploadDocument(input: {
  file: File;
  name?: string;
  type?: string;
  description?: string;
}): Promise<DocumentRecord> {
  if (USE_MOCK_API) {
    return {
      id: mockId("doc"),
      name: input.name || input.file.name,
      type: input.type ?? "general",
      mimeType: input.file.type,
      size: input.file.size,
      description: input.description,
      createdAt: new Date().toISOString(),
      downloadUrl: "#",
    };
  }

  const body = new FormData();
  body.append("file", input.file);
  if (input.name) body.append("name", input.name);
  if (input.type) body.append("type", input.type);
  if (input.description) body.append("description", input.description);

  const data = await apiRequest<any>("/documents", { method: "POST", body });
  return {
    id: String(data.document.id),
    name: data.document.name,
    type: data.document.type,
    mimeType: data.document.mime_type ?? undefined,
    size: Number(data.document.size ?? 0),
    description: data.document.description ?? undefined,
    uploadedBy: data.document.uploaded_by ?? undefined,
    createdAt: data.document.created_at,
    downloadUrl: data.document.download_url ?? "",
  };
}

export async function deleteDocument(id: string): Promise<void> {
  if (USE_MOCK_API) return;
  await apiRequest(`/documents/${id}`, { method: "DELETE" });
}
