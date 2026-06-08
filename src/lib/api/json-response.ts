export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "PRECONDITION_FAILED"
  | "INTERNAL_ERROR";

export interface ApiErrorIssue {
  path: (string | number)[];
  message: string;
}

export interface ApiErrorBody {
  error: {
    message: string;
    code: ApiErrorCode;
    issues?: ApiErrorIssue[];
  };
}

export interface ApiSuccessBody<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export function jsonOk(data: unknown, meta?: Record<string, unknown>, status = 200): Response {
  const body: ApiSuccessBody<unknown> = meta ? { data, meta } : { data };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(status: number, message: string, code: ApiErrorCode, issues?: ApiErrorIssue[]): Response {
  const body: ApiErrorBody = {
    error: {
      message,
      code,
      ...(issues && issues.length > 0 ? { issues } : {}),
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
