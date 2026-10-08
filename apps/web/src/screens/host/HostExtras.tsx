"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { EV, type StudentInfo } from "@iedc/shared/protocol";
import type { HistoryTournament, MonthlyFile } from "@iedc/shared/monthly";
import { host as H } from "@iedc/data/copy/host";
import { leaderboard as L } from "@iedc/data/copy/leaderboard";
import { emitAck } from "@/net/arena";
import { cx } from "@/lib/format";
import { Btn, Hand } from "@/ui/kit";
import { Mascot } from "@/ui/Mascot";

type Ack = { ok: boolean; error?: string };

async function call<T extends Ack>(event: string, payload?: unknown): Promise<T | null> {
  try {
    const res = await emitAck<T>(event, payload);
    if (!res.ok && res.error) alert(res.error);
    return res;
  } catch (e) {
    alert(e instanceof Error ? e.message : H.failed);
    return null;
  }
}

const fmtDate = (ts: number) => new Date(ts).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ------------------------------ students ------------------------------ */

export function StudentsTab() {
  const [list, setList] = useState<StudentInfo[] | null>(null);
  const [q, setQ] = useState("");
  const load = async () => {
    const res = await call<Ack & { students: StudentInfo[] }>(EV.hostStudents);
    if (res?.ok) setList(res.students);
  };
  useEffect(() => {
    void load();
  }, []);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list ?? []).filter((x) => !s || `${x.studentId} ${x.name} ${x.dept}`.toLowerCase().includes(s));
  }, [list, q]);

  return (
    <div className="flex flex-col gap-2">
      <input className="field !py-2" placeholder={H.studentsSearch} value={q} onChange={(e) => setQ(e.target.value)} />
      {list && <Hand className="text-sm">{H.studentsCount(list.length)}</Hand>}
      {list && shown.length === 0 && <Hand className="py-6 text-center text-lg">{H.studentsEmpty}</Hand>}
      {shown.map((s) => (
        <div key={s.studentId} className={cx("flex flex-wrap items-center gap-2 rounded-lg border-2 border-ink bg-card px-2.5 py-2", !!s.lockedUntil && "!border-stamp")}>
          <span className="font-mono text-sm font-black">{s.studentId}</span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate font-bold">{s.name}</div>
            <div className="text-xs text-pencil">
              {s.dept} · {s.sem} · {H.lastSeen(fmtDate(s.lastSeenAt))}
            </div>
          </div>
          <span className={cx("chip text-xs", s.hasPin ? "!bg-mint" : "!bg-yellow")}>{s.hasPin ? H.pinSet : H.noPin}</span>
          {s.lockedUntil && <span className="chip !bg-coral text-xs">{H.lockedUntil(fmtDate(s.lockedUntil))}</span>}
          {s.lockedUntil && (
            <button type="button" className="chip !bg-mint !px-1.5 text-xs" onClick={() => call(EV.hostUnlockStudent, { studentId: s.studentId }).then(load)}>
              {H.unlock}
            </button>
          )}
          {s.hasPin && (
            <button
              type="button"
              className="chip !px-1.5 text-xs !text-stamp"
              onClick={() =>
                confirm(H.confirmResetPin(s.studentId, s.name)) &&
                call(EV.hostResetPin, { studentId: s.studentId }).then((r) => {
                  if (r?.ok) alert(H.pinWasReset);
                  void load();
                })
              }
            >
              {H.resetPin}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ monthly ------------------------------ */

interface HistoryView extends Ack {
  tournaments: HistoryTournament[];
  currentId: string;
  file: MonthlyFile;
  added?: number;
}

export function MonthlyTab() {
  const [view, setView] = useState<HistoryView | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const load = async () => {
    const res = await call<HistoryView>(EV.hostHistory);
    if (res?.ok) setView(res);
  };
  useEffect(() => {
    void load();
  }, []);
  const apply = (res: HistoryView | null) => res?.ok && setView(res);

  const months = useMemo(() => {
    const by = new Map<string, HistoryTournament[]>();
    for (const t of view?.tournaments ?? []) by.set(t.month, [...(by.get(t.month) ?? []), t]);
    return [...by.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [view]);

  const exportForWebsite = async () => {
    const res = await call<Ack & { file: MonthlyFile }>(EV.hostExportMonthly);
    if (res?.ok) download("monthly.json", res.file);
  };
  const backup = async () => {
    const res = await call<Ack & { backup: unknown }>(EV.hostBackupHistory);
    if (res?.ok) download(`brain-arena-history-${new Date().toISOString().slice(0, 10)}.json`, res.backup);
  };
  const importFile = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      const res = await call<HistoryView>(EV.hostImportHistory, { tournaments: data.tournaments ?? [] });
      if (res?.ok) {
        setView(res);
        alert(H.imported(res.added ?? 0));
      }
    } catch {
      alert(H.importFailed);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Hand className="text-base">{H.monthlyIntro}</Hand>
      <div className="flex flex-wrap gap-2">
        <Btn size="sm" tone="mint" onClick={() => call<HistoryView>(EV.hostRecord).then((r) => r?.ok && (apply(r), alert(H.recordedNow)))}>
          {H.recordNow}
        </Btn>
        <a className="sticker !bg-yellow !px-3 !py-1.5 text-sm" href="/leaderboard/" target="_blank" rel="noreferrer">
          {H.monthlyLink}
        </a>
      </div>

      {months.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6">
          <Mascot mood="sleep" size={60} />
          <Hand className="text-lg">{H.monthlyEmpty}</Hand>
        </div>
      )}

      {months.map(([month, list]) => {
        const preview = view?.file.months[month];
        return (
          <section key={month} className="rounded-lg border-2 border-ink bg-card p-3">
            <h3 className="mb-2 text-lg font-black">{L.monthName(month)}</h3>
            <div className="flex flex-col gap-1.5">
              {list.map((t) => (
                <div key={t.id} className={cx("flex flex-wrap items-center gap-2 text-sm", !t.included && "opacity-55")}>
                  <label className="flex items-center gap-1.5 font-bold">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ink"
                      checked={t.included}
                      onChange={(e) => call<HistoryView>(EV.hostHistoryEdit, { id: t.id, included: e.target.checked }).then(apply)}
                    />
                    {t.included ? H.included : H.excluded}
                  </label>
                  <span className="flex-1 font-bold">
                    {t.name}
                    {t.id === view?.currentId && <span className="chip ml-2 !bg-yellow text-xs">now</span>}
                  </span>
                  <span className="text-pencil">
                    {fmtDate(t.date)} · {H.playersCount(t.players.length)}
                  </span>
                  <button
                    type="button"
                    className="chip !px-1.5 text-xs"
                    onClick={() => {
                      const name = prompt(H.renamePrompt, t.name);
                      if (name?.trim()) void call<HistoryView>(EV.hostHistoryEdit, { id: t.id, name: name.trim() }).then(apply);
                    }}
                  >
                    {H.rename}
                  </button>
                  <button
                    type="button"
                    className="chip !px-1.5 text-xs !text-stamp"
                    onClick={() => confirm(H.confirmRemove(t.name)) && call<HistoryView>(EV.hostHistoryEdit, { id: t.id, remove: true }).then(apply)}
                  >
                    {H.remove}
                  </button>
                </div>
              ))}
            </div>
            {preview && preview.standings.length > 0 && (
              <ol className="mt-3 grid gap-1 border-t-2 border-dashed border-pencil pt-2 text-sm sm:grid-cols-2">
                {preview.standings.slice(0, 10).map((r, i) => (
                  <li key={r.key} className="flex gap-2">
                    <span className="w-5 text-right font-black">{i + 1}</span>
                    <span className="flex-1 truncate">
                      {r.name} <span className="text-pencil">({r.dept})</span>
                    </span>
                    <span className="font-black tabular-nums">{r.points}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}

      <section className="rounded-lg border-2 border-dashed border-ink p-3">
        <h3 className="font-black">{H.publishTitle}</h3>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
          {H.publishSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn size="sm" tone="mint" onClick={exportForWebsite}>
            {H.downloadWebsite}
          </Btn>
          <Btn size="sm" tone="paper" onClick={backup}>
            {H.backup}
          </Btn>
          <Btn size="sm" tone="paper" onClick={() => fileInput.current?.click()}>
            {H.importBackup}
          </Btn>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = "";
            }}
          />
        </div>
        <Hand className="mt-2 block text-sm">{H.backupNote}</Hand>
      </section>
    </div>
  );
}
