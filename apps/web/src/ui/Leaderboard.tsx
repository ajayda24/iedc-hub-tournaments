"use client";
import type { DeptEntry, LbEntry, MeState } from "@iedc/shared/protocol";
import { cx } from "@/lib/format";
import { Avatar } from "./Avatar";
import { Hand } from "./kit";
import { useFlip } from "./useFlip";
import { common } from "@iedc/data/copy/common";

const RANK_BG = ["var(--color-yellow)", "#e9e4d8", "#f3c9a2"];

function Delta({ d }: { d: number }) {
  if (!d) return <span className="w-7" />;
  return (
    <span className={cx("w-7 text-right text-xs font-black", d > 0 ? "text-ok" : "text-stamp")}>
      {d > 0 ? "▲" : "▼"}
      {Math.abs(d)}
    </span>
  );
}

function StatusMark({ s }: { s: LbEntry["roundStatus"] }) {
  if (s === "solved") return <span className="chip !border-ok !py-0 text-[0.7rem] !text-ok">{common.status.solved}</span>;
  if (s === "locked") return <span className="chip !border-stamp !py-0 text-[0.7rem] !text-stamp">{common.status.locked}</span>;
  if (s === "out") return <span className="chip !py-0 text-[0.7rem] text-pencil">{common.status.out}</span>;
  return null;
}

export function Leaderboard({
  entries,
  meId,
  me,
  big,
  showStatus,
  max,
}: {
  entries: LbEntry[];
  meId?: string;
  me?: MeState | null;
  big?: boolean;
  showStatus?: boolean;
  max?: number;
}) {
  const shown = max ? entries.slice(0, max) : entries;
  const meShown = !meId || shown.some((e) => e.id === meId);
  const ref = useFlip<HTMLDivElement>(shown.map((e) => e.id).join());
  return (
    <div ref={ref} className="flex flex-col gap-1.5">
      {shown.length === 0 && <Hand className="py-6 text-center text-lg">{common.emptyBoard}</Hand>}
      {shown.map((e) => (
        <div
          key={e.id}
          data-flip={e.id}
          className={cx(
            "flex items-center gap-2.5 rounded-lg border-2 border-ink bg-card px-2.5",
            big ? "py-2 text-xl" : "py-1.5",
            e.id === meId && "!bg-yellow shadow-[3px_3px_0_0_var(--color-ink)]",
            e.eliminated && "opacity-55",
          )}
        >
          <span
            className={cx("grid shrink-0 place-items-center rounded-full border-2 border-ink font-black tabular-nums", big ? "h-10 w-10" : "h-8 w-8 text-sm")}
            style={{ background: RANK_BG[e.rank - 1] ?? "var(--color-card)" }}
          >
            {e.rank}
          </span>
          <Avatar seed={e.avatar} size={big ? 40 : 30} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold leading-tight">{e.name}</div>
            <div className={cx("text-pencil", big ? "text-sm" : "text-xs")}>
              {e.dept} · {e.sem}
              {e.streak >= 3 && <span className="ml-1 font-bold text-coral">· {common.streak(e.streak)}</span>}
            </div>
          </div>
          {showStatus && <StatusMark s={e.roundStatus} />}
          <Delta d={e.delta} />
          <span className={cx("min-w-[3.5rem] text-right font-black tabular-nums", big && "min-w-[5rem]")}>{e.score}</span>
        </div>
      ))}
      {!meShown && me && (
        <>
          <div className="text-center text-pencil">⋮</div>
          <div className="flex items-center gap-2.5 rounded-lg border-2 border-ink bg-yellow px-2.5 py-1.5 shadow-[3px_3px_0_0_var(--color-ink)]">
            <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-ink bg-card text-sm font-black">{me.rank}</span>
            <Avatar seed={me.avatar} size={30} />
            <div className="flex-1 truncate font-bold">{me.name}</div>
            <Delta d={me.delta} />
            <span className="min-w-[3.5rem] text-right font-black tabular-nums">{me.score}</span>
          </div>
        </>
      )}
    </div>
  );
}

export function DeptBoard({ depts, myDept, big }: { depts: DeptEntry[]; myDept?: string; big?: boolean }) {
  const top = Math.max(1, ...depts.map((d) => d.avg));
  const ref = useFlip<HTMLDivElement>(depts.map((d) => d.dept).join());
  return (
    <div ref={ref} className="flex flex-col gap-2">
      {depts.length === 0 && <Hand className="py-6 text-center text-lg">{common.noDepartments}</Hand>}
      {depts.map((d, i) => (
        <div key={d.dept} data-flip={d.dept} className={cx("flex items-center gap-3", big ? "text-xl" : "text-sm")}>
          <span className="w-6 text-right font-black">{i + 1}</span>
          <span className={cx("w-28 truncate font-bold", d.dept === myDept && "hl")}>{d.dept}</span>
          <div className="relative h-6 flex-1 overflow-hidden rounded border-2 border-ink bg-card">
            <div
              className="h-full transition-[width] duration-500"
              style={{ width: `${Math.max(4, (Math.max(0, d.avg) / top) * 100)}%`, background: ["var(--color-mint)", "var(--color-sky)", "var(--color-yellow)", "var(--color-coral)"][i % 4] }}
            />
          </div>
          <span className="w-14 text-right font-black tabular-nums">{d.avg}</span>
          <span className="w-10 text-right text-pencil">×{d.players}</span>
        </div>
      ))}
      <Hand className="text-sm">{common.deptLegend}</Hand>
    </div>
  );
}
