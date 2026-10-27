"use client";
import { useEffect, useState } from "react";
import { EVC } from "@iedc/shared/competitions/vibecoding/protocol";
import { vc } from "@iedc/config/copy/vibecoding";
import { Btn, ConnDot, Slip } from "@/ui/kit";
import { Mascot } from "@/ui/Mascot";
import { COMPETITION, Clock, Toast } from "./bits";
import { connectVc, reconnectVc, useVc, vcAct } from "./net";

const H = vc.host;
const PIN_KEY = "ba:pin";

/** The host console for Tile Rush. Same PIN as the weekly host console. */
export function VcHostApp() {
  const { host, wall, helloDone, helloError, conn } = useVc();
  const [pin, setPin] = useState("");
  const [tried, setTried] = useState(false);
  useEffect(() => {
    const saved = sessionStorage.getItem(PIN_KEY);
    if (saved) {
      setTried(true);
      connectVc({ competition: COMPETITION, role: "host", pin: saved });
    }
  }, []);
  const login = () => {
    sessionStorage.setItem(PIN_KEY, pin);
    setTried(true);
    reconnectVc({ competition: COMPETITION, role: "host", pin });
  };
  if (!host || !wall) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <Mascot mood={helloError ? "dizzy" : "think"} size={100} />
        <h1 className="text-3xl font-black">
          <span className="hl">{H.title}</span>
        </h1>
        <p className="font-semibold text-ink-soft">{H.pinHint}</p>
        <input
          className="field text-center text-3xl tracking-[0.4em]"
          inputMode="numeric"
          maxLength={8}
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && login()}
        />
        <Btn size="lg" tone="mint" className="w-full" onClick={login} disabled={pin.length < 4}>
          {H.enter}
        </Btn>
        {tried && helloDone && helloError && <p className="hand text-xl text-stamp">{helloError}</p>}
        {tried && conn === "offline" && <p className="hand text-xl text-stamp">{vc.cantReach}</p>}
      </main>
    );
  }
  const phase = wall.clock.phase;
  const next = { setup: "registration", registration: "warmup", warmup: "build", build: "frozen", frozen: "showcase", showcase: "closed" }[phase as string];
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 px-4 py-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-black">
          <span className="hl">{H.title}</span>
        </h1>
        <span className="chip">{vc.phase[phase]}</span>
        <Clock />
        <ConnDot conn={conn} />
      </header>
      <Slip className="flex flex-wrap items-center gap-3 p-4">
        {next && (
          <Btn tone="mint" onClick={() => vcAct(EVC.hostPhase, { phase: next })}>
            {H.next[phase]}
          </Btn>
        )}
        <span className="font-bold">{H.teams(wall.teams.length)}</span>
        <span className="font-bold">{H.people(host.people.length)}</span>
      </Slip>
      <Toast />
    </div>
  );
}
