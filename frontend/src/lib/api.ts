const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let sessionHeader: string | null = null;
export const setSessionHeader = (id: string | null) => {
  sessionHeader = id;
};

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...rest,
    method: rest.method ?? (json !== undefined ? "POST" : "GET"),
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(sessionHeader ? { "X-Session-Id": sessionHeader } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export function beacon(path: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  navigator.sendBeacon?.(`${BASE}${path}`, blob);
}
