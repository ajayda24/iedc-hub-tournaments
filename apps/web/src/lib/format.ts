import { common } from "@iedc/data/copy/common";

export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
export const fmtSecs = (ms: number) => `${(Math.round(ms / 100) / 10).toFixed(1)}s`;
export const firstName = (n: string) => n.split(" ")[0];
export const ordinal = common.ordinal;
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
