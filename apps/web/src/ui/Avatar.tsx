import { createRng } from "@iedc/shared/rng";

const FILLS = ["#ffe45c", "#7ee0b5", "#ff7a59", "#7cc6fe", "#f6efdf", "#ffb8d1"];

/**
 * Doodle face built from a seed: head shape, colour, eyes, mouth and a hat.
 * 6 × 3 × 5 × 5 × 5 = 2,250 combinations, all hand-drawn-ish.
 */
export function Avatar({ seed, size = 40, className }: { seed: number; size?: number; className?: string }) {
  const r = createRng(seed + 17);
  const fill = r.pick(FILLS);
  const shape = r.int(3);
  const eyes = r.int(5);
  const mouth = r.int(5);
  const hat = r.int(5);
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="#1d1b16"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {shape === 0 && <circle cx={24} cy={26} r={17} fill={fill} />}
      {shape === 1 && <rect x={7} y={9} width={34} height={34} rx={12} fill={fill} />}
      {shape === 2 && <path d="M24 9c11 0 18 6 17 17s-8 17-18 17S6 37 7 25 13 9 24 9z" fill={fill} />}

      {hat === 1 && <path d="M18 10c2-5 4-6 6-2 2-5 5-5 6 0" />}
      {hat === 2 && <path d="M9 17c3-9 27-9 30 0zM39 17h6" fill="#1d1b16" />}
      {hat === 3 && <path d="M8 18c10-4 22-4 32 0" stroke="#d93a2b" strokeWidth={3.4} />}
      {hat === 4 && (
        <>
          <path d="M24 9V3" />
          <circle cx={24} cy={3} r={2} fill="#ff7a59" />
        </>
      )}

      {eyes === 0 && (
        <g fill="#1d1b16" stroke="none">
          <circle cx={18} cy={24} r={2.2} />
          <circle cx={30} cy={24} r={2.2} />
        </g>
      )}
      {eyes === 1 && <path d="M15 24h6M27 24h6" />}
      {eyes === 2 && (
        <>
          <circle cx={18} cy={24} r={4} fill="#fffdf8" />
          <circle cx={30} cy={24} r={4} fill="#fffdf8" />
          <circle cx={19} cy={25} r={1.6} fill="#1d1b16" stroke="none" />
          <circle cx={31} cy={25} r={1.6} fill="#1d1b16" stroke="none" />
        </>
      )}
      {eyes === 3 && (
        <>
          <circle cx={18} cy={24} r={4.2} />
          <circle cx={30} cy={24} r={4.2} />
          <path d="M22 24h4" />
        </>
      )}
      {eyes === 4 && <path d="M15 25q3-4 6 0M27 25q3-4 6 0" />}

      {mouth === 0 && <path d="M19 32q5 5 10 0" />}
      {mouth === 1 && <circle cx={24} cy={33} r={2.6} fill="#1d1b16" stroke="none" />}
      {mouth === 2 && <path d="M19 33h10" />}
      {mouth === 3 && (
        <>
          <path d="M19 31q5 6 10 0" />
          <path d="M23 34v3q2 2 3 0v-3" fill="#ff7a59" strokeWidth={1.6} />
        </>
      )}
      {mouth === 4 && <path d="M18 32q6 5 12 0z" fill="#fffdf8" />}
    </svg>
  );
}

/** A fresh random avatar seed. */
export const randomAvatar = () => Math.floor(Math.random() * 1_000_000);
