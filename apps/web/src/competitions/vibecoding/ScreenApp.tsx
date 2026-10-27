"use client";
import { useEffect } from "react";
import { vc } from "@iedc/config/copy/vibecoding";
import { Hand } from "@/ui/kit";
import { Mascot } from "@/ui/Mascot";
import { COMPETITION, Clock } from "./bits";
import { connectVc, useVc } from "./net";

const S = vc.screen;

/** The projector wall for Tile Rush. */
export function VcScreenApp() {
  const wall = useVc((s) => s.wall);
  useEffect(() => {
    connectVc({ competition: COMPETITION, role: "screen" });
  }, []);
  if (!wall)
    return (
      <main className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Mascot mood="sleep" size={140} />
          <Hand className="text-3xl">{S.waiting}</Hand>
        </div>
      </main>
    );
  return (
    <div className="flex min-h-dvh flex-col px-10 py-6">
      <header className="flex items-center gap-6">
        <h1 className="mr-auto text-4xl font-black">
          <span className="hl">{wall.title}</span>
        </h1>
        <span className="chip text-xl">{vc.phase[wall.clock.phase]}</span>
        <Clock big />
      </header>
      <ul className="mt-6 grid grid-cols-3 gap-4">
        {wall.teams.map((t) => (
          <li key={t.id} className="slip p-4 text-2xl font-black">
            {t.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
