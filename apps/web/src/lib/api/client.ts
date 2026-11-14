export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export interface ApiOptions extends RequestInit {
  authenticated?: boolean;
}

export interface ApiClientOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
  onSessionExpired?: () => void;
}

export function createApiClient({
  baseUrl,
  fetcher = fetch,
  onSessionExpired,
}: ApiClientOptions) {
  const base = baseUrl.replace(/\/+$/, "");

  let refresh: Promise<void> | undefined;

  async function send<T>(
    path: string,
    options: ApiOptions = {},
    retried = false,
  ): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//")) {
      throw new Error("Use a relative API path.");
    }

    const { authenticated = true, ...init } = options;

    const headers = new Headers(init.headers);

    headers.set("Accept", "application/json");

    if (init.body && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    let response: Response;

    try {
      response = await fetcher(`${base}${path}`, {
        ...init,
        headers,
        credentials: "include",
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }

      throw new ApiError(
        "Unable to reach PayBridge. Check your connection and try again.",
        0,
      );
    }

    if (
      response.status === 401 &&
      authenticated &&
      !retried &&
      path !== "/auth/refresh"
    ) {
      if (!refresh) {
        refresh = send<unknown>("/auth/refresh", {
          method: "POST",
          authenticated: false,
        })
          .then(() => undefined)
          .catch((error: unknown) => {
            if (error instanceof ApiError && error.status === 401) {
              onSessionExpired?.();
            }

            throw error;
          })
          .finally(() => {
            refresh = undefined;
          });
      }

      await refresh;

      return send<T>(path, options, true);
    }

    const raw = await response.text();
    let payload: unknown;

    try {
      payload = raw ? JSON.parse(raw) : undefined;
    } catch {
      if (response.ok) {
        throw new ApiError(
          "PayBridge returned an unreadable response. Please try again.",
          response.status,
        );
      }
    }

    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && "message" in payload
          ? payload.message
          : undefined;

      const text =
        typeof message === "string"
          ? message
          : Array.isArray(message)
            ? message
                .filter((item): item is string => typeof item === "string")
                .join(" · ")
            : "";

      if (response.status === 401 && authenticated) {
        onSessionExpired?.();
      }

      throw new ApiError(
        text ||
          `PayBridge request failed (${response.status}). Please try again.`,
        response.status,
        payload,
      );
    }

    return payload as T;
  }

  return send;
}

export const apiRequest = createApiClient({
  baseUrl: "/api/paybridge",

  onSessionExpired: () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("paybridge:session-expired"));
    }
  },
});

export function queryString(query: object = {}): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const text = params.toString();

  return text ? `?${text}` : "";
}

export const segment = (value: string): string => encodeURIComponent(value);
