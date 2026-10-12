export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: {
    maxRetries?: number;
    timeoutMs?: number;
    baseDelayMs?: number;
    actionName?: string;
  } = {},
) {
  const {
    maxRetries = 3,
    timeoutMs = 12000,
    baseDelayMs = 350,
    actionName = "fetch",
  } = options;
  let lastError: unknown;
  let lastResponse: Response | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (![429, 500, 502, 503, 504].includes(response.status)) return response;
      lastResponse = response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
    }
    if (attempt < maxRetries) {
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * Math.pow(2, attempt - 1)),
      );
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError instanceof Error
    ? lastError
    : new Error(`${actionName} failed`);
}
