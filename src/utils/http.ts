export interface FetchOptions extends RequestInit {
  timeoutMs: number;
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

export async function fetchText(url: string, userAgent: string, timeoutMs: number): Promise<string> {
  const response = await fetchWithTimeout(url, {
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
