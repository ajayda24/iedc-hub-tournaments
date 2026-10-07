/**
 * Does this laptop reach the internet? If it does, the hotspot is probably
 * sharing mobile data and students could reach AI tools through it.
 */
const PROBES = ["http://connectivitycheck.gstatic.com/generate_204", "http://www.msftconnecttest.com/connecttest.txt", "https://1.1.1.1/cdn-cgi/trace"];

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
