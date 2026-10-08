/** localStorage that never throws (private mode, blocked storage…). */
export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
  del(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export function deviceToken(): string {
  let t = store.get<string | null>("ba:token", null);
  if (!t || t.length < 8) {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    t = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    store.set("ba:token", t);
  }
  return t;
}

export interface Profile {
  studentId?: string;
  name: string;
  sem: string;
  dept: string;
  avatar: number;
}
