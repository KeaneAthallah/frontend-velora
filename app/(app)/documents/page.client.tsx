"use client";

export const instant = false;

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, EmptyState, Field, Input, Select } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  DOCUMENT_TYPES,
  deleteDocument,
  listDocuments,
  uploadDocument,
  type DocumentRecord,
} from "@/lib/api/documents";
import { usePermissions } from "@/lib/auth/auth-context";
import { formatDate } from "@/lib/formatting/currency";

function fileSize(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes > 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export default function DocumentsPage() {
  const { has } = usePermissions();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);

  const documents = useQuery({
    queryKey: ["documents", type],
    queryFn: () => listDocuments({ type: type || undefined }),
    enabled: has("documents.view"),
  });

  const upload = useMutation({
    mutationFn: () => uploadDocument({ file: file as File, type: type || undefined }),
    onSuccess: () => {
      push({ title: "Document uploaded", variant: "success" });
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error) => push({ title: "Upload failed", description: String(error), variant: "error" }),
  });

  const remove = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      push({ title: "Document deleted", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error) => push({ title: "Could not delete", description: String(error), variant: "error" }),
  });

  if (!has("documents.view")) {
    return <AccessDenied permission="documents.view" />;
  }

  const canManage = has("documents.manage");

  const columns: Column<DocumentRecord>[] = [
    {
      id: "name",
      header: "Document",
      cell: (row) => (
        <div className="row" style={{ gap: 8 }}>
          <FileText aria-hidden="true" size={16} />
          <div>
            <div style={{ fontWeight: 600 }}>{row.name}</div>
            <div className="hint">{row.mimeType ?? "File"} · {fileSize(row.size)}</div>
          </div>
        </div>
      ),
    },
    { id: "type", header: "Type", cell: (row) => <span className="cell-muted">{row.type}</span> },
    { id: "uploaded", header: "Uploaded", cell: (row) => <span className="cell-muted">{formatDate(row.createdAt)}</span> },
    { id: "by", header: "By", cell: (row) => <span className="cell-muted">{row.uploadedBy ?? "—"}</span> },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
          <a className="btn btn--quiet btn--sm" href={row.downloadUrl} target="_blank" rel="noreferrer">
            <Download aria-hidden="true" /> Download
          </a>
          {canManage ? (
            <Button size="sm" variant="danger-quiet" onClick={() => remove.mutate(row.id)} disabled={remove.isPending}>
              <Trash2 aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Manage"
        title="Documents"
        description="Contracts, invoices, receipts and reports kept with the business."
      />

      {canManage ? (
        <Card>
          <CardHeader title="Upload a document" description="Files up to 10 MB." />
          <CardBody>
            <form
              className="row"
              style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}
              onSubmit={(event) => {
                event.preventDefault();
                if (file) upload.mutate();
              }}
            >
              <Field label="File" htmlFor="document-file">
                <Input
                  id="document-file"
                  type="file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </Field>
              <Field label="Type" htmlFor="document-type">
                <Select id="document-type" value={type} onChange={(event) => setType(event.target.value)}>
                  <option value="">General</option>
                  {DOCUMENT_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" variant="primary" loading={upload.isPending} disabled={!file}>
                <Upload aria-hidden="true" /> Upload
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Library" description={`${documents.data?.length ?? 0} files`} />
        <CardBody>
          {documents.isError ? (
            <InlineError title="Could not load documents" error={documents.error} onRetry={() => documents.refetch()} />
          ) : (
            <DataTable
              rows={documents.data ?? []}
              columns={columns}
              rowId={(row) => row.id}
              loading={documents.isPending}
              empty={<EmptyState compact icon={<FileText aria-hidden="true" />} title="No documents" description="Upload the first file above." />}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
