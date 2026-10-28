"use client";
import { useState } from "react";
import { EVC, type TeamView, type TileView } from "@iedc/shared/competitions/vibecoding/protocol";
import { vc } from "@iedc/config/copy/vibecoding";
import { cx } from "@/lib/format";
import { Btn, Hand, Slip } from "@/ui/kit";
import { Piece, useTicker } from "./bits";
import { useVc, vcAct } from "./net";

const B = vc.board;

/** Team header: score, rank, Asks, the shared cooldown. */
export function TeamBar({ team }: { team: TeamView }) {
  const now = useTicker(500);
  const cd = Math.max(0, Math.ceil((team.cooldownUntil - now) / 1000));
  const pendingBy = team.askPending ? team.members.find((m) => m.studentId === team.askPending!.by)?.name : null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
      <span className="chip !bg-yellow">
        {team.score.total} {B.points}
      </span>
      {team.rank > 0 && <span className="chip">#{team.rank}</span>}
      <span className={cx("chip", team.asksUsed >= team.askWarnAt && "!bg-coral")}>{B.asks(team.asksUsed, team.askCap)}</span>
      <span className={cx("chip", (cd > 0 || pendingBy) && "!bg-sky")}>
        {pendingBy ? `${vc.work.sending} (${pendingBy.split(" ")[0]})` : cd > 0 ? B.cooldown(cd) : B.ready}
      </span>
    </div>
  );
}

function TileCard({ tile, onOpen }: { tile: TileView; onOpen: () => void }) {
  const status = tile.done ? B.done : tile.holder ? B.inProgress(tile.holder.name.split(" ")[0]) : B.open;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx("slip relative flex aspect-square flex-col items-center justify-center gap-1 p-1.5 text-center", tile.done && "!bg-mint", tile.holder && !tile.done && "!bg-sky")}
      aria-label={`${tile.title}: ${status}`}
    >
      {tile.done && tile.piece ? (
        <div className="absolute inset-1 overflow-hidden rounded-md opacity-30">
          <Piece n={tile.piece} size={120} />
        </div>
      ) : null}
      <span className="relative text-2xl">{tile.done ? "✅" : tile.emoji}</span>
      <span className="relative text-[11px] font-black leading-tight">{tile.title}</span>
      <span className="relative text-[10px] font-semibold leading-tight text-ink-soft">{status}</span>
      {tile.checklist.some((c) => c.pass != null) && !tile.done && (
        <span className="relative text-[10px] font-bold">
          {tile.checklist.filter((c) => c.pass).length}/{tile.checklist.length} ✓
        </span>
      )}
    </button>
  );
}

/** The 3×3 board: 8 tiles in this team's order and the empty slot. */
export function Board({ team, onTile, onPuzzle, onPublish, onNotes }: { team: TeamView; onTile: (id: string) => void; onPuzzle: () => void; onPublish: () => void; onNotes: () => void }) {
  const wall = useVc((s) => s.wall);
  const tiles = team.tiles.filter((t) => t.id !== "warmup");
  const doneCount = tiles.filter((t) => t.done).length;
  const phase = wall?.clock.phase;
  return (
    <div className="flex flex-col gap-3">
      {wall?.clock.paused && <Slip className="p-2 text-center font-bold">{B.paused}</Slip>}
      {phase === "frozen" && <Slip className="p-2 text-center font-bold">{B.frozen}</Slip>}
      {team.message && (
        <Slip className="!bg-yellow p-3" taped>
          <Hand className="text-base">{B.message}</Hand>
          <p className="font-bold">{team.message.text}</p>
        </Slip>
      )}
      {team.changeRequest && team.changeRequest.doneAt == null && (
        <Slip className="!bg-lilac p-3">
          <div className="font-black">{vc.change.title}</div>
          <p className="font-bold">“{team.changeRequest.text}”</p>
          <p className="text-sm font-semibold">{vc.change.hint}</p>
        </Slip>
      )}
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <TileCard key={t.id} tile={t} onOpen={() => onTile(t.id)} />
        ))}
        <div className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink/40 p-1 text-center">
          {team.publish ? (
            <Btn size="sm" tone="mint" onClick={onPublish}>
              🚀 {B.publish}
            </Btn>
          ) : team.puzzle?.solvedAt != null ? (
            <Btn size="sm" tone="mint" onClick={onPublish}>
              🚀 {B.publish}
            </Btn>
          ) : team.puzzle ? (
            <Btn size="sm" tone="lilac" onClick={onPuzzle}>
              🧩 {B.puzzle}
            </Btn>
          ) : (
            <span className="text-xs font-bold text-ink-soft">{B.tilesDone(doneCount)}</span>
          )}
        </div>
      </div>
      {team.puzzle && team.puzzle.solvedAt == null && (
        <Btn tone="lilac" onClick={onPuzzle}>
          🧩 {B.puzzleReady}
        </Btn>
      )}
      <PictureWall team={team} />
      <Btn tone="paper" onClick={onNotes}>
        📝 {B.notes}
      </Btn>
    </div>
  );
}

/** The picture building up: each finished tile reveals its piece in place. */
export function PictureWall({ team, size = 34 }: { team: TeamView; size?: number }) {
  const revealed = new Set(team.tiles.filter((t) => t.done && t.piece).map((t) => t.piece!));
  return (
    <div className="mx-auto grid w-max grid-cols-3 gap-0.5 rounded-lg border-2 border-ink p-0.5" aria-label="your picture">
      {[1, 2, 3, 4, 5, 6, 7, 8, 0].map((n) => (n === 0 ? <div key="e" style={{ width: size, height: size }} /> : <Piece key={n} n={n} size={size} faded={!revealed.has(n)} />))}
    </div>
  );
}

/** Project Notes: shared by the team, sent to the AI with every Ask. */
export function Notes({ team, onClose }: { team: TeamView; onClose: () => void }) {
  const [text, setText] = useState(team.notes);
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <button type="button" className="self-start text-sm font-bold underline" onClick={onClose}>
        {vc.work.back}
      </button>
      <h2 className="text-2xl font-black">📝 {B.notes}</h2>
      <p className="text-sm font-semibold text-ink-soft">{B.notesHint}</p>
      <textarea
        className="field min-h-40"
        maxLength={500}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      <div className="flex items-center gap-3">
        <Btn
          tone="mint"
          onClick={async () => {
            const r = await vcAct(EVC.notesUpdate, { notes: text });
            if (r?.ok) setSaved(true);
          }}
        >
          {B.notesSave}
        </Btn>
        <span className="text-xs font-bold text-ink-soft">
          {text.trim().split(/\s+/).filter(Boolean).length} words · {text.length}/500
        </span>
        {saved && <Hand className="text-lg">{B.notesSaved}</Hand>}
      </div>
    </div>
  );
}
