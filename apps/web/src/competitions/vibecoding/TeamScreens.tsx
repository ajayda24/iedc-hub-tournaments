"use client";
import { useState } from "react";
import { EVC } from "@iedc/shared/competitions/vibecoding/protocol";
import { vc } from "@iedc/config/copy/vibecoding";
import { cx } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Btn, Hand, Slip } from "@/ui/kit";
import { Mascot } from "@/ui/Mascot";
import { useVc, vcAct } from "./net";
import { Waiting } from "./PlayerApp";

const T = vc.team;

/** No team yet: create one or join with a code. */
export function TeamSetup() {
  const { me, wall } = useVc();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const open = (wall?.clock.phase === "registration" || wall?.clock.phase === "warmup") && !wall?.registrationLocked;

  const run = async (event: string, payload: unknown) => {
    setBusy(true);
    await vcAct(event, payload);
    setBusy(false);
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-5 py-6">
      <header className="flex items-end gap-3">
        <Mascot mood="happy" size={64} />
        <h1 className="text-3xl font-black leading-none">
          <span className="hl">{T.hi(me?.name.split(" ")[0] ?? "")}</span>
        </h1>
      </header>
      {!open ? (
        wall?.clock.phase === "setup" ? (
          <Waiting text={T.waiting} />
        ) : (
          <Slip className="p-4 font-bold">{T.closed}</Slip>
        )
      ) : (
        <>
          <Slip className="flex flex-col gap-3 p-4" tilt={-0.6}>
            <h2 className="text-xl font-black">{T.createTitle}</h2>
            <p className="text-sm font-semibold text-ink-soft">{T.createHint}</p>
            <input className="field" maxLength={24} value={name} placeholder={T.namePlaceholder} onChange={(e) => setName(e.target.value)} />
            <Btn tone="mint" disabled={busy || name.trim().length < 2} onClick={() => run(EVC.teamCreate, { name })}>
              {T.create}
            </Btn>
          </Slip>
          <Hand className="text-center text-xl">{T.or}</Hand>
          <Slip className="flex flex-col gap-3 p-4" tilt={0.5}>
            <h2 className="text-xl font-black">{T.joinTitle}</h2>
            <p className="text-sm font-semibold text-ink-soft">{T.joinHint}</p>
            <input
              className="field text-center text-3xl uppercase tracking-[0.4em]"
              maxLength={4}
              value={code}
              placeholder={T.codePlaceholder}
              autoCapitalize="characters"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <Btn tone="sky" disabled={busy || code.trim().length !== 4} onClick={() => run(EVC.teamJoin, { code })}>
              {T.join}
            </Btn>
          </Slip>
        </>
      )}
    </main>
  );
}

/** Before the event starts: the team, its code, who's ready. */
export function Lobby() {
  const { me, team, wall } = useVc();
  if (!team || !me) return null;
  const mine = team.members.find((m) => m.studentId === me.studentId);
  const captain = team.captain === me.studentId;
  const min = wall?.settings.minTeamSize ?? 2;
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-5 py-6">
      <TeamCard />
      <Slip className="flex flex-col gap-2 p-4">
        {team.members.map((m) => (
          <div key={m.studentId} className="flex items-center gap-3">
            <Avatar seed={m.avatar} size={40} />
            <div className="mr-auto">
              <div className="font-black">
                {m.name} {team.captain === m.studentId && <span className="chip !py-0 text-xs">{T.captain}</span>}
              </div>
              <div className="text-xs font-semibold text-ink-soft">
                {m.dept} · {m.sem} <span className={cx("ml-1 inline-block h-2 w-2 rounded-full", m.online ? "bg-mint" : "bg-ink/20")} />
              </div>
            </div>
            <span className={cx("chip text-xs", m.ready && "!bg-mint")}>{m.ready ? "✓" : "…"}</span>
            {captain && m.studentId !== me.studentId && (
              <button type="button" className="text-xs font-bold underline" onClick={() => vcAct(EVC.teamKick, { studentId: m.studentId })}>
                {T.kick}
              </button>
            )}
          </div>
        ))}
        {team.members.length < min && <p className="text-sm font-bold text-stamp">{T.tooSmall(min)}</p>}
      </Slip>
      <Btn size="lg" tone={mine?.ready ? "paper" : "mint"} onClick={() => vcAct(EVC.memberReady, { ready: !mine?.ready })}>
        {mine?.ready ? T.notReady : T.ready}
      </Btn>
      <Waiting text={T.waiting} />
      <div className="flex justify-center gap-4 text-sm font-bold">
        {captain && (
          <button
            type="button"
            className="underline"
            onClick={() => {
              const name = prompt(T.renamePrompt, team.name);
              if (name) void vcAct(EVC.teamRename, { name });
            }}
          >
            {T.rename}
          </button>
        )}
        <button type="button" className="underline" onClick={() => vcAct(EVC.teamLeave)}>
          {T.leave}
        </button>
      </div>
    </main>
  );
}

export function TeamCard() {
  const team = useVc((s) => s.team);
  if (!team) return null;
  return (
    <Slip taped className="flex items-center gap-4 p-4" tilt={-0.8}>
      <div className="mr-auto">
        <Hand className="text-lg">{vc.stage[team.stage]}</Hand>
        <h1 className="text-3xl font-black leading-none">
          <span className="hl">{team.name}</span>
        </h1>
      </div>
      <div className="text-center">
        <div className="text-[11px] font-bold uppercase text-ink-soft">{T.code}</div>
        <div className="font-mono text-3xl font-black tracking-widest">{team.code}</div>
      </div>
    </Slip>
  );
}
