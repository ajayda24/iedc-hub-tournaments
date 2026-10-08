import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import type { GameColor } from "@iedc/shared/games/types";
import { cx } from "@/lib/format";
import { common } from "@iedc/data/copy/common";

export const COLOR: Record<GameColor | "paper" | "ink", string> = {
  yellow: "var(--color-yellow)",
  mint: "var(--color-mint)",
  coral: "var(--color-coral)",
  sky: "var(--color-sky)",
  paper: "var(--color-card)",
  ink: "var(--color-ink)",
};

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof COLOR; size?: "sm" | "md" | "lg" };

export function Btn({ tone = "yellow", size = "md", className, style, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "sticker",
        size === "sm" && "!px-3 !py-1.5 text-sm",
        size === "lg" && "!px-6 !py-3.5 text-lg",
        tone === "ink" && "!text-paper",
        className,
      )}
      style={{ background: COLOR[tone], ...style }}
    />
  );
}

export function Slip({
  tilt = 0,
  taped = false,
  className,
  style,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tilt?: number; taped?: boolean }) {
  return (
    <div
      {...rest}
      className={cx("slip", taped && "taped", className)}
      style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined, ...style }}
    />
  );
}

export function Hand({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("hand text-pencil", className)}>{children}</span>;
}

/** A doodled arrow pointing right-down, for margin notes like "← that's you". */
export function DoodleArrow({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 60 30" className={className} style={flip ? { transform: "scaleX(-1)" } : undefined} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M2 6c14 16 32 18 52 12" />
      <path d="M46 10l9 8-11 5" />
    </svg>
  );
}

export function Squiggle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 12" className={className} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" preserveAspectRatio="none">
      <path d="M2 8c10-8 18 6 28 0s18-8 28 0 18 6 28 0 18-6 30 0" />
    </svg>
  );
}

export function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" stroke="#1d1b16" strokeWidth={1.8} strokeLinejoin="round">
      <path d="M12 2l2.6 6.4 6.9.5-5.3 4.4 1.7 6.7L12 16.3 6.1 20l1.7-6.7L2.5 8.9l6.9-.5z" />
    </svg>
  );
}

export function ConnDot({ conn }: { conn: string }) {
  const color = conn === "online" ? "var(--color-ok)" : conn === "connecting" ? "var(--color-yellow)" : "var(--color-stamp)";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold" title={conn}>
      <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-ink" style={{ background: color }} />
      {conn === "online" ? common.connection.online : conn === "connecting" ? common.connection.connecting : common.connection.offline}
    </span>
  );
}
