export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
export const fmtSecs = (ms: number) => `${(Math.round(ms / 100) / 10).toFixed(1)}s`;
export const firstName = (n: string) => n.split(" ")[0];
export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
