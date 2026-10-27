"use client";
import { useEffect, useState } from "react";
import { EVC } from "@iedc/shared/competitions/vibecoding/protocol";
import type { StudentCheckAck } from "@iedc/shared/protocol";
import { vc } from "@iedc/config/copy/vibecoding";
import { JoinForm, type JoinTransport } from "@/screens/JoinForm";
import { Mascot } from "@/ui/Mascot";
import { Btn, ConnDot, Hand, Slip } from "@/ui/kit";
import { COMPETITION, Clock, Toast } from "./bits";
import { connectVc, reconnectVc, useVc, vcAck } from "./net";
import { TeamSetup, Lobby } from "./TeamScreens";
import { PlayerMain } from "./PlayerMain";
import { useInternetReport } from "./useInternet";

const transport: JoinTransport = {
  title: "Tile Rush",
  check: (studentId) => vcAck<StudentCheckAck>(EVC.studentCheck, { studentId }),
  join: async (payload) => {
    const res = await vcAck<{ ok: boolean; error?: string; me?: unknown }>(EVC.join, payload);
    if (res.ok && res.me) useVc.setState({ me: res.me as never });
    return res;
  },
};

/** Phones: join → team → lobby → board → … (the rest lives in PlayerMain). */
export function VcPlayerApp() {
  const { conn, helloDone, helloError, me, team, wall, bumped } = useVc();
  useEffect(() => {
    connectVc({ competition: COMPETITION, role: "player" });
  }, []);
  useInternetReport(!!me);

  if (bumped)
    return (
      <Center mood="sleep" title={vc.bumpedTitle} body={bumped}>
        <Btn onClick={() => reconnectVc({ competition: COMPETITION, role: "player" })}>↻</Btn>
      </Center>
    );
  if (!helloDone || !wall) return <Center mood={conn === "offline" ? "dizzy" : "think"} title={conn === "offline" ? vc.cantReach : vc.connecting} />;
  if (helloError) return <Center mood="dizzy" title={helloError} />;

  let body;
  if (!me) {
    body = (
      <>
        <p className="mx-auto max-w-md px-5 pt-4 text-sm font-semibold text-ink-soft">{vc.privacy}</p>
        <JoinForm via={transport} />
      </>
    );
  } else if (!team) body = <TeamSetup />;
  else if (["setup", "registration"].includes(wall.clock.phase)) body = <Lobby />;
  else body = <PlayerMain />;

  return (
    <div className="min-h-dvh">
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b-2 border-ink/10 bg-paper/90 px-3 py-1.5 text-sm backdrop-blur">
        <span className="font-black">Tile Rush</span>
        <span className="chip !py-0.5 text-xs">{vc.phase[wall.clock.phase]}</span>
        {wall.clock.phase === "build" && <Clock className="ml-1 !text-base" />}
        <span className="ml-auto">
          <ConnDot conn={conn} />
        </span>
      </div>
      {body}
      <Toast />
    </div>
  );
}

export function Center({ mood, title, body, children }: { mood: "sleep" | "think" | "dizzy" | "happy"; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <Mascot mood={mood} size={110} />
      <h1 className="text-2xl font-black">{title}</h1>
      {body && <p className="font-semibold text-ink-soft">{body}</p>}
      {children}
    </main>
  );
}

export function Waiting({ text }: { text: string }) {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d + 1) % 4), 600);
    return () => clearInterval(t);
  }, []);
  return (
    <Slip className="flex items-center gap-3 p-4">
      <Mascot mood="sleep" size={48} />
      <Hand className="text-xl">
        {text.replace(/…$/, "")}
        {".".repeat(dots)}
      </Hand>
    </Slip>
  );
}
