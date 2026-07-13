const TRANSIENT_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfterMs = (value) => {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());

  return null;
};

/**
 * Fetches a resource with exponential backoff for temporary upstream failures.
 *
 * This retries transient HTTP statuses and network errors, then fails loudly
 * so packaging never continues with an incomplete resource.
 */
export const fetchWithRetry = async (
  url,
  init,
  {
    attempts = 4,
    baseDelayMs = 1000,
    label = url,
  } = {},
) => {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;

      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `[retry] ${label} fetch failed: ${error instanceof Error ? error.message : String(error)}; ` +
          `retrying in ${Math.round(delayMs)}ms (attempt ${attempt}/${attempts})`,
      );
      await sleep(delayMs);
      continue;
    }

    if (response.ok) return response;

    if (!TRANSIENT_HTTP_STATUS.has(response.status) || attempt === attempts) {
      throw new Error(`${label} returned HTTP ${response.status} ${response.statusText}`);
    }

    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
    // Cap server-suggested waits so a pathological Retry-After can't stall CI.
    const delayMs = Math.min(retryAfterMs ?? baseDelayMs * 2 ** (attempt - 1), 60_000);
    console.warn(
      `[retry] ${label} temporary HTTP ${response.status}; retrying in ${Math.round(delayMs)}ms ` +
        `(attempt ${attempt}/${attempts})`,
    );
    await sleep(delayMs);
  }

  throw lastError ?? new Error(`Failed to fetch ${label}`);
};
