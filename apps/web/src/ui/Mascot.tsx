import { cx } from "@/lib/format";

export type Mood = "idle" | "happy" | "think" | "sweat" | "dizzy" | "sleep" | "crown" | "shock";

const GLASS = "M60 14C84 14 100 31 100 55C100 72 89 82 83 92L81 101H39L37 92C31 82 20 72 20 55C20 31 36 14 60 14Z";

/**
 * Bulbu — the doodled lightbulb who reacts to everything. Pure SVG, no assets.
 */
export function Mascot({ mood = "idle", size = 120, className, bob = true }: { mood?: Mood; size?: number; className?: string; bob?: boolean }) {
  const lit = mood === "happy" || mood === "crown";
  const fill = mood === "sleep" ? "#f6efdf" : mood === "dizzy" ? "#ffd0c2" : "#ffe45c";
  return (
    <svg
      viewBox="0 0 120 160"
      width={size}
      height={(size * 160) / 120}
      className={cx(bob && mood !== "sleep" && "animate-bob", className)}
      role="img"
      aria-label={`Bulbu looks ${mood}`}
      fill="none"
      stroke="#1d1b16"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {lit && (
        <path d="M14 24l-9-7M106 24l9-7M8 56H1M112 56h7" />
      )}
      {mood === "crown" && <path d="M40 18l4-14 9 9 7-11 7 11 9-9 4 14z" fill="#ffe45c" strokeWidth={2.5} />}

      {/* arms */}
      {mood === "happy" || mood === "crown" ? (
        <>
          <path d="M22 62C14 50 10 40 8 30" />
          <path d="M98 62C106 50 110 40 112 30" />
        </>
      ) : mood === "think" ? (
        <>
          <path d="M22 66C12 74 10 84 14 92" />
          <path d="M98 66C110 72 100 86 82 80" />
        </>
      ) : mood === "shock" ? (
        <>
          <path d="M22 60C10 58 4 48 4 40" />
          <path d="M98 60C110 58 116 48 116 40" />
        </>
      ) : (
        <>
          <path d="M22 66C12 74 8 82 8 92" />
          <path d="M98 66C108 74 112 82 112 92" />
        </>
      )}

      {/* legs */}
      <path d="M50 122L45 146H36" />
      <path d="M70 122L75 146H84" />

      {/* glass + screw base */}
      <path d={GLASS} fill={fill} />
      <path d="M52 86C52 76 56 72 60 80C64 72 68 76 68 86" strokeWidth={2} stroke="#8a8172" />
      <rect x={39} y={101} width={42} height={8} rx={3} fill="#cfc6b3" />
      <rect x={41} y={109} width={38} height={8} rx={3} fill="#cfc6b3" />
      <path d="M50 117h20l-4 6H54z" fill="#1d1b16" />

      {/* face */}
      <Eyes mood={mood} />
      <Mouth mood={mood} />
      {(mood === "idle" || mood === "happy" || mood === "crown") && (
        <g stroke="none" fill="#ff7a59" opacity={0.55}>
          <ellipse cx={36} cy={60} rx={6} ry={3.5} />
          <ellipse cx={84} cy={60} rx={6} ry={3.5} />
        </g>
      )}

      {mood === "sweat" && (
        <path className="animate-drip" d="M98 30c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12z" fill="#7cc6fe" strokeWidth={2} />
      )}
      {mood === "think" && (
        <text x={96} y={20} fontSize={26} fill="#1d1b16" stroke="none" fontFamily="var(--font-hand)">
          ?
        </text>
      )}
      {mood === "sleep" && (
        <text x={88} y={24} fontSize={20} fill="#1d1b16" stroke="none" fontFamily="var(--font-hand)">
          z z
        </text>
      )}
    </svg>
  );
}

function Eyes({ mood }: { mood: Mood }) {
  if (mood === "sleep" || mood === "happy" || mood === "crown") {
    const d = mood === "sleep" ? "M40 48q6 4 12 0M68 48q6 4 12 0" : "M40 50q6-7 12 0M68 50q6-7 12 0";
    return <path d={d} />;
  }
  if (mood === "dizzy") return <path d="M41 42l10 10M51 42L41 52M69 42l10 10M79 42L69 52" />;
  const dy = mood === "think" ? -4 : 0;
  const r = mood === "shock" ? 7 : 5;
  return (
    <g className="animate-blink" style={{ transformOrigin: "60px 48px" }}>
      <ellipse cx={46} cy={48} rx={r} ry={r + 1} fill="#fffdf8" strokeWidth={2.5} />
      <ellipse cx={74} cy={48} rx={r} ry={r + 1} fill="#fffdf8" strokeWidth={2.5} />
      <circle cx={47} cy={49 + dy} r={2.4} fill="#1d1b16" stroke="none" />
      <circle cx={75} cy={49 + dy} r={2.4} fill="#1d1b16" stroke="none" />
    </g>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case "happy":
    case "crown":
      return <path d="M46 62q14 16 28 0z" fill="#1d1b16" />;
    case "sweat":
      return <path d="M49 68q11-8 22 0" />;
    case "dizzy":
      return <path d="M46 66q4-5 7 0t7 0 7 0 7 0" />;
    case "shock":
      return <ellipse cx={60} cy={67} rx={6} ry={8} fill="#1d1b16" />;
    case "think":
      return <path d="M52 66h14" />;
    case "sleep":
      return <path d="M55 64q5 4 10 0" />;
    default:
      return <path d="M49 62q11 10 22 0" />;
  }
}
