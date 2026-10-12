export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public issues: { path: (string | number)[]; message: string }[] = [],
    public meta: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function apiRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  try {
    const response = await fetch(`/api/commerce/${path}`, {
      method: options.method ?? "GET",
      headers:
        options.body === undefined
          ? undefined
          : { "Content-Type": "application/json" },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
    });
    const text = await response.text();
    const data = text
      ? (() => {
          try {
            return JSON.parse(text);
          } catch {
            return {};
          }
        })()
      : {};
    if (!response.ok)
      throw new ApiError(
        response.status,
        data.code ?? "REQUEST_FAILED",
        data.message ?? "The request could not be completed.",
        data.issues ?? [],
        data,
      );
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "We could not reach the service. Your input is still here. If you were saving, reload the saved shop before trying again.",
    );
  }
}
