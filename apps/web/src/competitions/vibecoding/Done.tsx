"use client";
import { useState } from "react";
import { EVC, type TeamView } from "@iedc/shared/competitions/vibecoding/protocol";
import { VOCABULARY } from "@iedc/shared/competitions/vibecoding/config";
import { vc } from "@iedc/config/copy/vibecoding";
import { Btn, Hand, Slip } from "@/ui/kit";
import { Mascot } from "@/ui/Mascot";
import { PictureWall } from "./Board";
import { fmtMin } from "./bits";
import { useVc, vcAct } from "./net";
import { siteUrl } from "./Publish";

const D = vc.done;

/** After the build: the team's summary, badges and the glossary reveal. */
export function DoneView({ team }: { team: TeamView }) {
  const wall = useVc((s) => s.wall);
  const tiles = team.tiles.filter((t) => t.id !== "warmup");
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <Mascot mood="crown" size={64} />
        <div>
          <Hand className="text-xl">{D.title}</Hand>
          <h1 className="text-3xl font-black leading-none">
            <span className="hl">{team.name}</span>
          </h1>
        </div>
      </header>
      <Slip className="flex flex-col gap-2 p-4" taped>
        <div className="flex items-end justify-between">
          <span className="font-black">{D.score}</span>
          <span className="text-4xl font-black tabular-nums">{team.score.total}</span>
        </div>
        <span className="chip self-start">#{team.rank}</span>
        <ul className="text-sm font-semibold">
          {tiles.map((t) => (
            <li key={t.id} className="flex justify-between">
              <span>
                {t.done ? "✅" : "▫️"} {t.title}
                {t.doneAt != null && t.firstOpenedAt != null && <span className="text-ink-soft"> · {fmtMin(t.doneAt - t.firstOpenedAt)}</span>}
              </span>
              <span className="tabular-nums">{team.score.tiles[t.id as keyof typeof team.score.tiles]?.points ?? 0}</span>
            </li>
          ))}
          {team.score.team.map((l) => (
            <li key={l.label} className="flex justify-between">
              <span>⭐ {l.label}</span>
              <span className="tabular-nums">{l.points}</span>
            </li>
          ))}
        </ul>
      </Slip>
      <PictureWall team={team} size={44} />
      {team.badges.length > 0 && (
        <Slip className="p-4">
          <div className="mb-1 font-black">🏅 {D.badges}</div>
          <div className="flex flex-wrap gap-2">
            {team.badges.map((b) => (
              <span key={b} className="chip !bg-yellow">
                {b}
              </span>
            ))}
          </div>
        </Slip>
      )}
      {team.publish && wall && (
        <a className="sticker !bg-sky text-center" href={siteUrl(wall.sitesPort, team.publish.sitePath)} target="_blank" rel="noreferrer">
          🚀 {vc.publish.open}
        </a>
      )}
      <Slip className="flex flex-col gap-2 p-4" tilt={0.5}>
        <div className="text-xl font-black">🤯 {D.glossaryTitle}</div>
        <p className="text-sm font-semibold">{D.glossaryIntro}</p>
        <table className="text-sm">
          <tbody>
            {Object.values(VOCABULARY).map((w) => (
              <tr key={w.friendly}>
                <td className="py-0.5 pr-3 font-bold">{w.friendly}</td>
                <td>→ {w.real}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Slip>
    </div>
  );
}

/** Best-Looking Site: one vote per Student ID, not for your own team. */
export function VoteView() {
  const { wall, me } = useVc();
  const [voted, setVoted] = useState<string | null>(null);
  if (!wall || !wall.votingOpen) return null;
  const sites = wall.teams.filter((t) => t.sitePath && t.id !== me?.teamId);
  return (
    <Slip className="flex flex-col gap-3 p-4">
      <h2 className="text-xl font-black">🗳 {vc.vote.title}</h2>
      <p className="text-sm font-semibold">{vc.vote.hint}</p>
      {voted ? (
        <Hand className="text-2xl">{vc.vote.voted}</Hand>
      ) : (
        sites.map((t) => (
          <div key={t.id} className="flex items-center gap-2">
            <a className="mr-auto font-bold underline" href={siteUrl(wall.sitesPort, t.sitePath!)} target="_blank" rel="noreferrer">
              {t.name}
            </a>
            <Btn
              size="sm"
              tone="mint"
              onClick={async () => {
                const r = await vcAct(EVC.voteCast, { teamId: t.id });
                if (r?.ok || r?.error === vc.vote.voted || /already voted/i.test(r?.error ?? "")) setVoted(t.id);
              }}
            >
              {vc.vote.vote}
            </Btn>
          </div>
        ))
      )}
    </Slip>
  );
}
