"use client";
import { EVC, type TeamView } from "@iedc/shared/competitions/vibecoding/protocol";
import { vc } from "@iedc/config/copy/vibecoding";
import { Btn, Hand } from "@/ui/kit";
import { sfx } from "@/ui/sfx";
import { Piece, clockNow, fmtMin, useTicker } from "./bits";
import { useVc, vcAct } from "./net";

const P = vc.puzzle;
const NEXT_TO = (a: number, b: number) => (Math.abs(a - b) === 3 || (Math.abs(a - b) === 1 && Math.floor(a / 3) === Math.floor(b / 3)));

/** The 3×3 sliding puzzle. Any member can move; the arena keeps the moves in order. */
export function PuzzleView({ team, onBack, onPublish }: { team: TeamView; onBack: () => void; onPublish: () => void }) {
  const wall = useVc((s) => s.wall);
  const now = useTicker(500);
  const p = team.puzzle;
  if (!p) return null;
  const solved = p.solvedAt != null;
  const elapsed = (solved ? p.solvedAt! : clockNow(wall?.clock, now).elapsedMs) - p.startedAt;
  const empty = p.board.indexOf(0);
  const size = 104;

  const move = async (cell: number) => {
    if (solved || !NEXT_TO(cell, empty)) return;
    sfx.tap();
    const r = await vcAct<{ ok: boolean; board?: number[] }>(EVC.puzzleMove, { cell, version: p.version });
    if (r?.ok && r.board?.every((v, i) => v === [1, 2, 3, 4, 5, 6, 7, 8, 0][i])) sfx.win();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button type="button" className="self-start text-sm font-bold underline" onClick={onBack}>
        {vc.work.back}
      </button>
      <h2 className="text-center text-2xl font-black">🧩 {solved ? P.solved : P.title}</h2>
      {!solved && <p className="font-semibold text-ink-soft">{P.hint}</p>}
      <div className="flex gap-3 text-sm font-bold">
        <span className="chip">{P.moves(p.moves)}</span>
        <span className="chip">⏱ {fmtMin(Math.max(0, elapsed))}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-xl border-2 border-ink bg-card p-1" role="grid" aria-label="puzzle">
        {p.board.map((n, cell) => (
          <button
            key={cell}
            type="button"
            role="gridcell"
            aria-label={n ? `piece ${n}` : "empty"}
            disabled={solved || !n || !NEXT_TO(cell, empty)}
            onClick={() => move(cell)}
            className="rounded-md disabled:cursor-default"
          >
            <Piece n={n} size={size} />
          </button>
        ))}
      </div>
      {solved && (
        <>
          <Hand className="text-2xl">🎉 {P.solved}</Hand>
          <Btn size="lg" tone="mint" onClick={onPublish}>
            🚀 {vc.board.publish}
          </Btn>
        </>
      )}
    </div>
  );
}
