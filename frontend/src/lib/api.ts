export class ApiError extends Error {
  status: number;
  body: unknown;
  fieldErrors: Record<string, string>;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
    this.fieldErrors = extractFieldErrors(body);
  }
}

let csrfToken: string | null = null;

export async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  const data = await apiGet<{ csrf_token: string }>("/api/auth/csrf");
  csrfToken = data.csrf_token;
  return csrfToken;
}

export function clearCsrf() {
  csrfToken = null;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return parseResponse<T>(response);
}

export async function apiSend<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  return sendWithCsrfRetry(method, path, body);
}

async function sendWithCsrfRetry<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  retried = false,
): Promise<T> {
  const csrf = await ensureCsrf();
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok && !retried && response.status === 403) {
    const text = await response.clone().text();
    if (/csrf/i.test(text)) {
      clearCsrf();
      return sendWithCsrfRetry(method, path, body, true);
    }
  }
  return parseResponse<T>(response);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiSend<T>("POST", path, body);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiSend<T>("PUT", path, body);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiSend<T>("PATCH", path, body);
}

export async function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return apiSend<T>("DELETE", path, body);
}

/** Multipart POST (do not set Content-Type — browser sets boundary). */
export async function apiUploadForm<T>(path: string, form: FormData): Promise<T> {
  const csrf = await ensureCsrf();
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-CSRF-Token": csrf,
    },
    body: form,
  });
  return parseResponse<T>(response);
}

export async function downloadAuthenticated(path: string, filename: string): Promise<void> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { Accept: "application/zip, application/octet-stream" },
  });
  if (!response.ok) {
    await parseResponse(response);
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, formatErrorMessage(data, response.status), data);
  }

  return data as T;
}

function extractFieldErrors(body: unknown): Record<string, string> {
  if (!body || typeof body !== "object") return {};
  const detail = (body as { detail?: unknown }).detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(detail as Record<string, unknown>)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  }
  return {};
}

function formatErrorMessage(data: unknown, status: number): string {
  if (!data || typeof data !== "object") return `Request failed (${status})`;
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const values = Object.values(detail as Record<string, unknown>).filter(
      (value): value is string => typeof value === "string",
    );
    if (values[0]) return values[0];
  }
  if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object") {
    const first = detail[0] as { msg?: string };
    if (first.msg) return first.msg;
  }
  if (status === 502) {
    return "Email could not be sent. Ask the admin to check Resend settings.";
  }
  return `Request failed (${status})`;
}
