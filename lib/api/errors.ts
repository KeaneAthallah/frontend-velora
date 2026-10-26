export type ApiError = {
  status: number;
  code?: string;
  message: string;
  details?: unknown;
};

export class ApiException extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(err: ApiError) {
    super(err.message);
    this.status = err.status;
    this.code = err.code;
    this.details = err.details;
  }
}

export function toApiError(res: Response, body: unknown): ApiError {
  const message =
    (typeof body === "object" && body && "message" in body && typeof (body as { message: unknown }).message === "string"
      ? (body as { message: string }).message
      : res.statusText) || "Request failed";
  const code =
    typeof body === "object" && body && "code" in body && typeof (body as { code: unknown }).code === "string"
      ? (body as { code: string }).code
      : undefined;
  return { status: res.status, code, message, details: body };
}
