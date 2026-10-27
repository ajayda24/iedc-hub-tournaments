"use client";
import { vc } from "@iedc/config/copy/vibecoding";
import { useVc } from "./net";
import { TeamCard } from "./TeamScreens";
import { Waiting } from "./PlayerApp";

/** Warm-up and the build: board, workspace, puzzle, publish (filled in by later gates). */
export function PlayerMain() {
  const wall = useVc((s) => s.wall);
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-5 py-6">
      <TeamCard />
      <Waiting text={vc.phase[wall?.clock.phase ?? "setup"]} />
    </main>
  );
}
