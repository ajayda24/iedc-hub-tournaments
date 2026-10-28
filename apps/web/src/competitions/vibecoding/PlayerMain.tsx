"use client";
import { useState } from "react";
import type { TileId } from "@iedc/shared/competitions/vibecoding/config";
import { vc } from "@iedc/config/copy/vibecoding";
import { Btn, Slip } from "@/ui/kit";
import { useVc } from "./net";
import { TeamCard } from "./TeamScreens";
import { Board, Notes, TeamBar } from "./Board";
import { Workspace } from "./Workspace";
import { PuzzleView } from "./Puzzle";
import { PublishView } from "./Publish";
import { DoneView, VoteView } from "./Done";

type View = { kind: "board" } | { kind: "tile"; id: TileId } | { kind: "notes" } | { kind: "puzzle" } | { kind: "publish" };

/** Warm-up and the build: board, workspace, notes, puzzle, publish; then the showcase. */
export function PlayerMain() {
  const team = useVc((s) => s.team);
  const wall = useVc((s) => s.wall);
  const [view, setView] = useState<View>({ kind: "board" });
  if (!team || !wall) return null;
  const phase = wall.clock.phase;
  const board = () => setView({ kind: "board" });

  let body;
  if (phase === "warmup") {
    body =
      view.kind === "tile" ? (
        <Workspace team={team} tileId="warmup" onBack={board} />
      ) : view.kind === "notes" ? (
        <Notes team={team} onClose={board} />
      ) : (
        <div className="flex flex-col gap-3">
          <TeamCard />
          <TeamBar team={team} />
          <Slip className="flex flex-col gap-2 p-4" tilt={-0.4}>
            <h2 className="text-xl font-black">👋 {vc.phase.warmup}</h2>
            <p className="font-semibold">{vc.board.warmupHint}</p>
            <Btn tone="mint" onClick={() => setView({ kind: "tile", id: "warmup" })}>
              {team.tiles[0].title} →
            </Btn>
          </Slip>
          <Btn tone="paper" onClick={() => setView({ kind: "notes" })}>
            📝 {vc.board.notes}
          </Btn>
        </div>
      );
  } else if ((phase === "showcase" || phase === "closed") && view.kind === "board") {
    body = (
      <div className="flex flex-col gap-4">
        <DoneView team={team} />
        <VoteView />
      </div>
    );
  } else if (view.kind === "tile") body = <Workspace team={team} tileId={view.id} onBack={board} />;
  else if (view.kind === "notes") body = <Notes team={team} onClose={board} />;
  else if (view.kind === "puzzle") body = <PuzzleView team={team} onBack={board} onPublish={() => setView({ kind: "publish" })} />;
  else if (view.kind === "publish") body = <PublishView team={team} onBack={board} />;
  else
    body = (
      <div className="flex flex-col gap-3">
        <TeamBar team={team} />
        <Board
          team={team}
          onTile={(id) => setView({ kind: "tile", id: id as TileId })}
          onPuzzle={() => setView({ kind: "puzzle" })}
          onPublish={() => setView({ kind: "publish" })}
          onNotes={() => setView({ kind: "notes" })}
        />
      </div>
    );
  return <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">{body}</main>;
}
