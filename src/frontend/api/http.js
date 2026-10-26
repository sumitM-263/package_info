const cache = new Map();
const TTL = 5 * 60 * 1000;

export class ApiError extends Error {
  constructor(kind, message, status = null) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getJson(url, { timeoutMs = 8000, retries = 1 } = {}) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) {
    return hit.data;
  }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.status === 404) {
        throw new ApiError('not_found', 'Package not found', 404);
      }
      if (response.status === 429) {
        if (attempt < retries) {
          await sleep(1200 * (attempt + 1));
          continue;
        }
        throw new ApiError('rate_limited', 'Rate limited by npm', 429);
      }
      if (!response.ok) {
        if (response.status >= 500 && attempt < retries) {
          await sleep(600);
          continue;
        }
        throw new ApiError('server', `npm returned ${response.status}`, response.status);
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new ApiError('bad_data', 'Unreadable response');
      }

      cache.set(url, { at: Date.now(), data: payload });
      return payload;
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof ApiError) throw error;
      if (error.name === 'AbortError') {
        if (attempt < retries) {
          continue;
        }
        throw new ApiError('timeout', 'Request timed out');
      }
      if (attempt < retries) {
        await sleep(600);
        continue;
      }
      throw new ApiError('network', 'Network error');
    } finally {
      clearTimeout(timer);
    }
  }
}
