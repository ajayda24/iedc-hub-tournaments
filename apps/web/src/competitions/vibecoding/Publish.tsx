"use client";
import { useState } from "react";
import { EVC, type PublishAck, type TeamView } from "@iedc/shared/competitions/vibecoding/protocol";
import { vc } from "@iedc/config/copy/vibecoding";
import { arenaUrl } from "@/lib/arenaUrl";
import { Btn, Hand, Slip } from "@/ui/kit";
import { Mascot } from "@/ui/Mascot";
import { sfx } from "@/ui/sfx";
import { Confetti } from "@/ui/Confetti";
import { useVc, vcAct } from "./net";

const P = vc.publish;

export function siteUrl(sitesPort: number, sitePath: string) {
  if (typeof window === "undefined") return sitePath;
  return `${window.location.protocol}//${window.location.hostname}:${sitesPort}${sitePath}`;
}

/** Publish: check the whole page, put it live, show the link + QR; then the client's change request. */
export function PublishView({ team, onBack }: { team: TeamView; onBack: () => void }) {
  const wall = useVc((s) => s.wall);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PublishAck | null>(null);
  const live = wall?.clock.phase === "build" && !wall.clock.paused;
  const url = team.publish && wall ? siteUrl(wall.sitesPort, team.publish.sitePath) : null;

  const go = async () => {
    setBusy(true);
    setResult(null);
    const r = await vcAct<PublishAck>(EVC.publishGo, {}, 60_000);
    setBusy(false);
    if (r) setResult(r);
    if (r?.ok) sfx.win();
    else if (r) sfx.buzz();
  };

  return (
    <div className="flex flex-col gap-4">
      {result?.ok && <Confetti />}
      <button type="button" className="self-start text-sm font-bold underline" onClick={onBack}>
        {vc.work.back}
      </button>
      <h2 className="text-2xl font-black">🚀 {P.title}</h2>
      <p className="font-semibold">{P.intro}</p>

      {team.publish?.stale && <Slip className="!bg-coral p-3 font-bold">{P.stale}</Slip>}
      {team.changeRequest && (
        <Slip className={team.changeRequest.doneAt != null ? "!bg-mint p-3" : "!bg-lilac p-3"}>
          <div className="font-black">{team.changeRequest.doneAt != null ? `✅ ${vc.change.done}` : vc.change.title}</div>
          <p className="font-bold">“{team.changeRequest.text}”</p>
          {team.changeRequest.doneAt == null && <p className="text-sm font-semibold">{vc.change.hint}</p>}
        </Slip>
      )}

      <Btn size="lg" tone="mint" disabled={busy || !live} onClick={go}>
        {busy ? P.checking : team.publish ? P.again : P.go}
      </Btn>
      {busy && (
        <div className="flex items-center gap-2">
          <Mascot mood="think" size={44} />
          <Hand className="text-xl">{P.checking}</Hand>
        </div>
      )}

      {result && !result.ok && result.problems && (
        <Slip className="flex flex-col gap-2 p-3">
          <p className="font-black text-stamp">{P.failed}</p>
          {result.problems.map((p) => (
            <div key={p.tileId}>
              <div className="font-bold">{p.tileId === "page" ? P.pageProblem : p.title}</div>
              {p.tileId !== "page" && (
                <ul className="ml-5 list-disc text-sm font-semibold">
                  {p.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </Slip>
      )}
      {result?.ok && result.problems?.some((p) => p.tileId === "change") && <Slip className="p-3 font-bold">{P.changeProblem}</Slip>}

      {url && (
        <Slip className="flex flex-col items-center gap-3 p-4 text-center" taped>
          <Hand className="text-2xl">{P.live}</Hand>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${arenaUrl()}/api/qr?text=${encodeURIComponent(url)}`} alt="QR code for your site" width={180} height={180} />
          <div className="break-all font-mono text-xs">{url}</div>
          <div className="flex gap-2">
            <a className="sticker !bg-sky !px-4 !py-2" href={url} target="_blank" rel="noreferrer">
              {P.open}
            </a>
            <a className="sticker !bg-paper !px-4 !py-2" href={`${url}index.html?download=1`}>
              ⬇ {P.download}
            </a>
          </div>
          {team.publish && <span className="chip">#{team.publish.rank}</span>}
        </Slip>
      )}
    </div>
  );
}
