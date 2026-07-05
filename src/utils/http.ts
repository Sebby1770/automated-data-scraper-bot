export interface FetchOptions extends RequestInit {
  timeoutMs: number;
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
}

export async function fetchWithTimeout(url: string, options: FetchOptions): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWithRetry(
  url: string,
  options: FetchOptions,
  retry: RetryOptions = {}
): Promise<Response> {
  const retries = retry.retries ?? 3;
  const baseDelayMs = retry.baseDelayMs ?? 500;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, options);
      if (response.ok || response.status < 500) {
        return response;
      }

      lastError = new Error(`GET ${url} failed with ${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < retries) {
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchText(url: string, userAgent: string, timeoutMs: number): Promise<string> {
  const response = await fetchWithRetry(url, {
    timeoutMs,
    headers: {
      "user-agent": userAgent,
      accept: "text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export async function fetchJson(url: string, userAgent: string, timeoutMs: number): Promise<unknown> {
  const response = await fetchWithRetry(url, {
    timeoutMs,
    headers: {
      "user-agent": userAgent,
      accept: "application/json,text/json,*/*"
    }
  });

  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<unknown>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}