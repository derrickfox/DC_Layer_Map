const PREFIX = 'dc_map_';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getCached(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { data, expires } = JSON.parse(raw);
    if (Date.now() > expires) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function setCached(key, data, ttlMs = DEFAULT_TTL_MS) {
  try {
    localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ data, expires: Date.now() + ttlMs })
    );
  } catch {
    // QuotaExceededError or serialization error — skip silently, app still works
  }
}

export async function fetchWithCache(key, fetcher, ttlMs = DEFAULT_TTL_MS) {
  const cached = getCached(key);
  if (cached !== null) return cached;
  const data = await fetcher();
  setCached(key, data, ttlMs);
  return data;
}
