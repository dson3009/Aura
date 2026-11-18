const API_URL = "/api/backend";
const DEFAULT_TIMEOUT_MS = 15_000;

type ApiRequestOptions = RequestInit & {
  timeoutMs?: number;
  skipAuth?: boolean;
};

type WrappedResponse<T> =
  | { success: true; data: T }
  | { success: false; message?: string };

function isWrappedResponse<T>(value: unknown): value is WrappedResponse<T> {
  return typeof value === "object" && value !== null && "success" in value;
}

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: externalSignal, skipAuth = false, ...fetchOptions } = options;
  const controller = new AbortController();
  let timedOut = false;

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
    }
  }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      credentials: "include",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
        ...fetchOptions.headers,
      },
    });

    const rawBody = await res.text();
    const json = rawBody ? JSON.parse(rawBody) : undefined;

    if (res.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("auraspa_session");
        window.location.href = "/login";
      }
      throw new Error("SESSION_EXPIRED");
    }

    if (!res.ok) {
      throw new Error(json?.message || "Da co loi xay ra");
    }

    if (json === undefined) {
      return undefined as T;
    }

    if (isWrappedResponse<T>(json)) {
      if (!json.success) {
        throw new Error(json.message || "Da co loi xay ra");
      }

      return json.data;
    }

    return json as T;
  } catch (err) {
    if (timedOut) {
      throw new Error("Request timed out. Please try again.");
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}

export const api = {
  get: <T>(path: string, options?: ApiRequestOptions) => request<T>(path, options),
  post: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>(path, { ...options, method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, options?: ApiRequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
};
