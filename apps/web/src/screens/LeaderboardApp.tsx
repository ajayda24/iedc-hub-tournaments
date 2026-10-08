"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MonthlyFile, MonthlyRow } from "@iedc/shared/monthly";
import bundled from "@iedc/data/leaderboard/monthly.json";
import { leaderboard as L } from "@iedc/data/copy/leaderboard";
import { arenaUrl, isArenaOrigin } from "@/lib/arena";
import { cx } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Hand, Slip } from "@/ui/kit";
import { DeptBoard } from "@/ui/Leaderboard";
import { Mascot } from "@/ui/Mascot";
import { useFlip } from "@/ui/useFlip";
import { Credits } from "@/ui/Credits";

const avatarOf = (key: string) => parseInt(key, 36) % 1_000_000;
const PODIUM_BG = ["#e9e4d8", "var(--color-yellow)", "#f3c9a2"];

/**
 * Monthly standings. Online it shows the file committed to the repo; on the
 * event Wi-Fi it asks the arena laptop for the live version first.
 */
export function LeaderboardApp() {
  const [file, setFile] = useState<MonthlyFile>(bundled as MonthlyFile);
  const [live, setLive] = useState(false);
  const months = useMemo(() => Object.keys(file.months).sort().reverse(), [file]);
  const [month, setMonth] = useState<string | null>(null);
  const [tab, setTab] = useState<"players" | "depts">("players");

  useEffect(() => {
    if (!isArenaOrigin()) return;
    fetch(`${arenaUrl()}/api/leaderboard`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((f: MonthlyFile | null) => {
        if (f?.months) {
          setFile(f);
          setLive(true);
        }
      })
      .catch(() => {});
  }, []);

  const current = month && file.months[month] ? month : months[0] ?? null;
  const data = current ? file.months[current] : null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pb-16 pt-6 md:pl-20">
      <nav className="flex items-center gap-3">
        <Link href="/" className="chip">
          {L.home}
        </Link>
      </nav>
      <header className="flex items-end gap-4">
        <Mascot mood="crown" size={80} />
        <div>
          <h1 className="text-4xl font-black leading-none">
            <span className="hl">{L.title}</span>
          </h1>
          <p className="mt-2 font-medium text-ink-soft">{L.intro}</p>
          <p className="mt-1 text-sm font-bold" data-testid="last-updated">
            {L.lastUpdated(L.formatDate(file.updatedAt))}
            {live && <span className="chip ml-2 !bg-mint text-xs">{L.liveFromLaptop}</span>}
          </p>
        </div>
      </header>

      {months.length === 0 ? (
        <Slip taped className="flex flex-col items-center gap-2 px-4 pb-6 pt-8 text-center">
          <Mascot mood="sleep" size={80} />
          <Hand className="text-xl">{L.empty}</Hand>
        </Slip>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {months.map((m) => (
              <button key={m} type="button" onClick={() => setMonth(m)} className={cx("chip !px-3 !py-1.5", m === current && "!bg-ink !text-paper")}>
                {L.monthName(m)}
              </button>
            ))}
          </div>

          {data && data.standings.length > 0 ? (
            <>
              <Podium rows={data.standings.slice(0, 3)} />
              <div className="flex gap-2">
                {(["players", "depts"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setTab(k)} className={cx("chip !px-3 !py-1", tab === k && "!bg-ink !text-paper")}>
                    {L.tabs[k]}
                  </button>
                ))}
              </div>
              {tab === "players" ? (
                <Table rows={data.standings} />
              ) : (
                <DeptBoard depts={data.depts.map((d) => ({ dept: d.dept, players: d.players, total: d.points, avg: d.avg }))} />
              )}
              <section>
                <Hand className="text-lg">{L.tournamentsCounted(data.tournaments.length)}</Hand>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {data.tournaments.map((t) => (
                    <li key={`${t.name}-${t.date}`} className="chip text-xs">
                      {t.name} · {new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {L.playersCount(t.players)}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : (
            <Hand className="py-8 text-center text-xl">{L.emptyMonth}</Hand>
          )}
        </>
      )}
      <Credits />
    </main>
  );
}

function Podium({ rows }: { rows: MonthlyRow[] }) {
  const order = [rows[1], rows[0], rows[2]];
  const heights = [90, 130, 70];
  return (
    <div className="flex items-end justify-center gap-3">
      {order.map((r, i) =>
        r ? (
          <div key={r.key} className="flex flex-col items-center" style={{ animation: `podium-rise 0.7s cubic-bezier(.2,1.4,.4,1) ${[0.4, 0.8, 0.1][i]}s both` }}>
            <Avatar seed={avatarOf(r.key)} size={52} />
            <div className="mt-1 max-w-[8rem] truncate text-center text-sm font-black">{r.name}</div>
            <div className="text-xs text-pencil">{r.dept}</div>
            <div className="slip mt-2 flex w-24 flex-col items-center pt-2 sm:w-28" style={{ height: heights[i], background: PODIUM_BG[i] }}>
              <span className="text-3xl font-black">{[2, 1, 3][i]}</span>
              <span className="text-sm font-bold tabular-nums">{r.points}</span>
            </div>
          </div>
        ) : (
          <div key={i} className="w-24 sm:w-28" />
        ),
      )}
    </div>
  );
}

function Table({ rows }: { rows: MonthlyRow[] }) {
  const ref = useFlip<HTMLOListElement>(rows.map((r) => r.key).join());
  return (
    <ol ref={ref} className="flex flex-col gap-1.5">
      {rows.map((r, i) => (
        <li key={r.key} data-flip={r.key} className="flex items-center gap-2.5 rounded-lg border-2 border-ink bg-card px-2.5 py-1.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-ink text-sm font-black" style={{ background: PODIUM_BG[[1, 0, 2][i]] ?? "var(--color-card)" }}>
            {i + 1}
          </span>
          <Avatar seed={avatarOf(r.key)} size={30} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate font-bold">{r.name}</div>
            <div className="text-xs text-pencil">
              {r.dept} · {r.sem} · {L.played(r.played)}
              {r.wins > 0 && <span className="font-bold text-coral"> · {L.wins(r.wins)}</span>}
            </div>
          </div>
          <span className="min-w-[4rem] text-right font-black tabular-nums">{r.points}</span>
        </li>
      ))}
    </ol>
  );
}
