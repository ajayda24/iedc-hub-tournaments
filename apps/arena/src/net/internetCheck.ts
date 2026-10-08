import { LAPTOP_PROBE_URLS } from "@iedc/data/network";

/**
 * Does this laptop reach the internet? If it does, the hotspot is probably
 * sharing mobile data and students could reach AI tools through it.
 */
const PROBES = LAPTOP_PROBE_URLS;

export async function hasInternet(timeoutMs = 2500): Promise<boolean> {
  const tries = PROBES.map(async (url) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store", redirect: "manual" });
      return res.status > 0 && res.status < 500;
    } catch {
      return false;
    } finally {
      clearTimeout(t);
    }
  });
  const results = await Promise.all(tries);
  return results.some(Boolean);
}
