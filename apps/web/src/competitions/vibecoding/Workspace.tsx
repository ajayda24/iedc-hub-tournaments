"use client";
import { useEffect, useMemo, useState } from "react";
import { EVC, type AskAck, type CheckAck, type TeamView, type TileView } from "@iedc/shared/competitions/vibecoding/protocol";
import { compose } from "@iedc/shared/competitions/vibecoding/composer";
import type { TileId } from "@iedc/shared/competitions/vibecoding/config";
import { vc } from "@iedc/config/copy/vibecoding";
import { cx } from "@/lib/format";
import { Btn, Hand, Slip } from "@/ui/kit";
import { Mascot } from "@/ui/Mascot";
import { sfx } from "@/ui/sfx";
import { TeamBar } from "./Board";
import { clockNow, useTicker } from "./bits";
import { showToast, useVc, vcAct } from "./net";

const W = vc.work;

/** One tile: brief, checklist, Ask, preview, Save Point / Go Back, hints, code, Check. */
export function Workspace({ team, tileId, onBack }: { team: TeamView; tileId: TileId; onBack: () => void }) {
  const me = useVc((s) => s.me);
  const wall = useVc((s) => s.wall);
  const tile = team.tiles.find((t) => t.id === tileId)!;
  const now = useTicker(500);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState<"ask" | "check" | null>(null);
  const [reply, setReply] = useState<{ text: string; kind: "ai" | "backup" | "glitch" } | null>(null);
  const [panel, setPanel] = useState<"none" | "goBack" | "code" | "hints">("none");
  const [full, setFull] = useState(false);

  const mine = tile.holder?.studentId === me?.studentId;
  const phase = wall?.clock.phase;
  const live = tileId === "warmup" ? phase === "warmup" : phase === "build";
  const blocked = team.blockedMembers.includes(me?.studentId ?? "");
  const cd = Math.max(0, Math.ceil((team.cooldownUntil - now) / 1000));
  const elapsed = clockNow(wall?.clock, now).elapsedMs;

  // claim the tile on entry (if free), let it go on leave
  useEffect(() => {
    if (live && !tile.holder) void vcAct(EVC.tileOpen, { tileId });
    return () => void vcAct(EVC.tileClose, { tileId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileId]);

  const preview = useMemo(() => {
    const frags = Object.fromEntries(team.tiles.map((t) => [t.id, t.fragment]));
    if (full && tileId !== "warmup") return compose(frags, { placeholders: true, csp: true });
    return compose({ [tileId]: tile.fragment }, { tiles: [tileId], placeholders: true, csp: true });
  }, [team.tiles, tile.fragment, tileId, full]);

  const send = async () => {
    if (!ask.trim()) return;
    setBusy("ask");
    setReply(null);
    const r = await vcAct<AskAck>(EVC.askSend, { tileId, text: ask }, 120_000);
    setBusy(null);
    if (!r?.ok) return;
    if (r.glitched) {
      setReply({ text: W.glitched, kind: "glitch" });
      sfx.buzz();
    } else setReply({ text: r.backup ? W.backup : r.explanation || "✓", kind: r.backup ? "backup" : "ai" });
    if (r.check && r.check.passed === r.check.total) {
      sfx.win();
      showToast(W.allPassed);
    }
    setAsk("");
  };

  const check = async () => {
    setBusy("check");
    const r = await vcAct<CheckAck>(EVC.checkRun, { tileId });
    setBusy(null);
    if (r?.done) {
      sfx.win();
      showToast(W.allPassed);
    }
  };

  const autoSolveIn = tile.autoSolveAt != null ? Math.max(0, Math.ceil((tile.autoSolveAt - elapsed) / 60_000)) : null;
  const canEdit = live && mine && wall?.settings.allowCodeEdit !== false && !team.askPending;
  const canShowMe = tileId !== "warmup" && !tile.done && autoSolveIn === 0 && team.autoSolves < team.autoSolveMax;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button type="button" className="text-sm font-bold underline" onClick={onBack}>
          {W.back}
        </button>
        <span className="ml-auto">
          <TeamBar team={team} />
        </span>
      </div>
      <header className="flex items-center gap-2">
        <span className="text-3xl">{tile.emoji}</span>
        <h2 className="mr-auto text-2xl font-black leading-tight">{tile.title}</h2>
        {tile.done && <span className="chip !bg-mint">✓ {vc.board.done}</span>}
      </header>
      {/* students write their own Asks: the brief and checklist can't be copied */}
      <p className="select-none font-semibold" onCopy={noCopy} onContextMenu={noCopy}>
        {tileId === "warmup" ? vc.board.warmupHint : tile.brief}
      </p>

      <Slip className="select-none p-3" onCopy={noCopy} onContextMenu={noCopy}>
        <div className="mb-1 text-xs font-black uppercase tracking-wide text-ink-soft">{W.checklist}</div>
        <ul className="flex flex-col gap-1">
          {tile.checklist.map((c) => (
            <li key={c.id} className="flex gap-2 text-sm font-semibold">
              <span aria-hidden>{c.pass == null ? "○" : c.pass ? "✅" : "❌"}</span>
              <span>{c.text}</span>
            </li>
          ))}
        </ul>
      </Slip>

      {!live ? (
        <Slip className="p-3 font-bold">{phase === "frozen" || phase === "showcase" || phase === "closed" ? W.frozen : vc.phase[phase ?? "setup"]}</Slip>
      ) : !mine ? (
        <Slip className="flex items-center gap-3 p-3">
          <Mascot mood="think" size={40} />
          <span className="mr-auto font-bold">{tile.holder ? W.watching(tile.holder.name.split(" ")[0]) : ""}</span>
          {!tile.holder && (
            <Btn size="sm" tone="sky" onClick={() => vcAct(EVC.tileOpen, { tileId })}>
              {W.take}
            </Btn>
          )}
        </Slip>
      ) : (
        <Slip className="flex flex-col gap-2 p-3" tilt={-0.3}>
          {blocked && <p className="text-sm font-bold text-stamp">{W.internet}</p>}
          <textarea
            className="field min-h-24 text-base"
            maxLength={600}
            placeholder={W.askPlaceholder}
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              showToast(W.noPaste);
            }}
            onDrop={(e) => e.preventDefault()}
            disabled={busy === "ask"}
          />
          <div className="flex items-center gap-2">
            <Btn tone="mint" onClick={send} disabled={busy === "ask" || !ask.trim() || cd > 0 || !!team.askPending || blocked}>
              {busy === "ask" || team.askPending ? W.sending : cd > 0 ? vc.board.cooldown(cd) : W.send}
            </Btn>
            <span className="ml-auto text-xs font-bold text-ink-soft">{ask.length}/600</span>
          </div>
          {team.asksUsed >= team.askWarnAt && tileId !== "warmup" && <p className="text-xs font-bold text-stamp">{vc.board.askWarn}</p>}
          {busy === "ask" && (
            <div className="flex items-center gap-2">
              <Mascot mood="think" size={36} />
              <Hand className="text-lg">{W.sending}</Hand>
            </div>
          )}
          {reply && (
            <div className={cx("rounded-lg border-2 p-2 text-sm font-semibold", reply.kind === "ai" ? "border-ink/20" : "border-stamp")}>
              {reply.kind === "ai" && <span className="mr-1 font-black">{W.aiSaid}:</span>}
              {reply.text}
            </div>
          )}
        </Slip>
      )}

      <div className="flex flex-wrap gap-2">
        <Btn size="sm" tone="yellow" onClick={check} disabled={!live || busy === "check" || now < tile.checkReadyAt}>
          {busy === "check" ? W.checking : `✔ ${W.check}`}
        </Btn>
        <Btn
          size="sm"
          tone="paper"
          disabled={!live}
          onClick={async () => {
            const note = prompt(W.saveNotePrompt) ?? undefined;
            const r = await vcAct(EVC.saveCreate, { tileId, note: note || undefined });
            if (r?.ok) showToast(W.saved);
          }}
        >
          💾 {W.save}
        </Btn>
        <Btn size="sm" tone="paper" onClick={() => setPanel(panel === "goBack" ? "none" : "goBack")}>
          ↩ {W.goBack}
        </Btn>
        <Btn size="sm" tone="paper" onClick={() => setPanel(panel === "hints" ? "none" : "hints")}>
          💡 {W.hint}
        </Btn>
        <Btn size="sm" tone="paper" onClick={() => setPanel(panel === "code" ? "none" : "code")}>
          {"</>"} {panel === "code" ? W.hideCode : canEdit ? W.editCode : W.code}
        </Btn>
        {canShowMe && (
          <Btn
            size="sm"
            tone="coral"
            disabled={!live}
            onClick={() => {
              if (confirm(W.showMeConfirm)) void vcAct(EVC.autosolveUse, { tileId });
            }}
          >
            🪄 {W.showMe}
          </Btn>
        )}
        {!canShowMe && autoSolveIn != null && autoSolveIn > 0 && !tile.done && <span className="self-center text-xs font-bold text-ink-soft">{W.showMeIn(autoSolveIn)}</span>}
      </div>

      {panel === "goBack" && <GoBack tile={tile} live={live && mine} />}
      {panel === "hints" && <Hints tile={tile} live={live} />}
      {panel === "code" &&
        (canEdit ? (
          <CodeEditor key={`${tileId}-${tile.saves.length}-${tile.edits}-${tile.asks}`} tile={tile} />
        ) : (
          <pre className="max-h-72 overflow-auto rounded-lg bg-ink p-3 text-xs leading-snug text-paper" aria-label="code (read only)">
            {`<!-- HTML -->\n${tile.fragment.html || "(empty)"}\n\n/* CSS */\n${tile.fragment.css || "(empty)"}\n\n// JS\n${tile.fragment.js || "(empty)"}`}
          </pre>
        ))}

      <div className="flex items-center gap-2">
        <span className="text-xs font-black uppercase tracking-wide text-ink-soft">{W.preview}</span>
        {tileId !== "warmup" && (
          <div className="ml-auto flex gap-1">
            <button type="button" className={cx("chip !py-0.5 text-xs", !full && "!bg-ink !text-paper")} onClick={() => setFull(false)}>
              {W.thisSection}
            </button>
            <button type="button" className={cx("chip !py-0.5 text-xs", full && "!bg-ink !text-paper")} onClick={() => setFull(true)}>
              {W.fullPage}
            </button>
          </div>
        )}
      </div>
      <iframe title={W.preview} sandbox="allow-scripts" srcDoc={preview} className="h-96 w-full rounded-xl border-2 border-ink bg-white" />
    </div>
  );
}

const noCopy = (e: React.SyntheticEvent) => e.preventDefault();

/** Edit the tile's code by hand (when the host allows it): free, auto-saved first, then checked. */
function CodeEditor({ tile }: { tile: TileView }) {
  const [f, setF] = useState(tile.fragment);
  const [busy, setBusy] = useState(false);
  const changed = f.html !== tile.fragment.html || f.css !== tile.fragment.css || f.js !== tile.fragment.js;
  const box = (k: "html" | "css" | "js", label: string) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-black uppercase tracking-wide text-paper/70">{label}</span>
      <textarea
        className="min-h-28 rounded-md bg-black/40 p-2 font-mono text-xs leading-snug text-paper outline-none focus:ring-2 focus:ring-yellow"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
      />
    </label>
  );
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-ink p-3">
      <p className="text-xs font-semibold text-paper/80">{W.editHint}</p>
      {box("html", "HTML")}
      {box("css", "CSS")}
      {box("js", "JS")}
      <div className="flex gap-2">
        <Btn
          size="sm"
          tone="mint"
          disabled={!changed || busy}
          onClick={async () => {
            setBusy(true);
            const r = await vcAct<CheckAck>(EVC.codeEdit, { tileId: tile.id, ...f }, 30_000);
            setBusy(false);
            if (r?.done) {
              sfx.win();
              showToast(W.allPassed);
            }
          }}
        >
          {busy ? W.checking : W.saveCode}
        </Btn>
        {changed && (
          <Btn size="sm" tone="paper" onClick={() => setF(tile.fragment)}>
            ↺
          </Btn>
        )}
      </div>
    </div>
  );
}

/**
 * Every version of the tile, newest first, each saying what replaced it and
 * whether it is the code the tile has now. Peek shows it before going back.
 */
function GoBack({ tile, live }: { tile: TileView; live: boolean }) {
  const [peek, setPeek] = useState<{ id: string; html: string } | null>(null);
  const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const showPeek = async (saveId: string) => {
    if (peek?.id === saveId) return setPeek(null);
    const r = await vcAct<{ ok: boolean; fragment?: TileView["fragment"] }>(EVC.savePreview, { tileId: tile.id, saveId });
    if (r?.ok && r.fragment) setPeek({ id: saveId, html: compose({ [tile.id]: r.fragment }, { tiles: [tile.id], placeholders: true, csp: true }) });
  };
  return (
    <Slip className="flex flex-col gap-2 p-3">
      <p className="text-sm font-semibold text-ink-soft">{W.goBackHint}</p>
      {tile.saves.length === 0 && <p className="text-sm font-bold">{W.goBackEmpty}</p>}
      {tile.saves.map((s) => (
        <div key={s.id} className={cx("flex flex-col gap-1 rounded-lg border-2 p-2 text-sm", s.current ? "border-mint bg-mint/20" : "border-ink/10")}>
          <div className="flex items-start gap-2">
            <span className={cx("chip !py-0 text-xs", s.kind === "save" && "!bg-yellow")}>{s.kind === "save" ? "💾" : "⟲"}</span>
            <div className="mr-auto min-w-0">
              <div className="font-bold">
                {s.label}
                {s.note ? ` · ${s.note}` : ""}
                <span className="ml-1 text-xs font-semibold text-ink-soft">{time(s.at)}</span>
                {s.current && <span className="chip ml-1 !bg-mint !py-0 text-xs">{W.current}</span>}
              </div>
              {s.detail && <div className="truncate text-xs font-semibold text-ink-soft">“{s.detail}”</div>}
              <div className="truncate text-xs text-ink-soft">
                {s.text || "(empty)"} · {W.versionInfo(s.cssChars, s.jsChars)}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Btn size="sm" tone="paper" onClick={() => showPeek(s.id)}>
              👀 {peek?.id === s.id ? W.hidePeek : W.peek}
            </Btn>
            {!s.current && (
              <Btn
                size="sm"
                tone="sky"
                disabled={!live}
                onClick={async () => {
                  const r = await vcAct(EVC.saveRestore, { tileId: tile.id, saveId: s.id }, 15_000);
                  if (r?.ok) {
                    setPeek(null);
                    showToast(W.restored(s.note || s.label));
                  }
                }}
              >
                {W.restore}
              </Btn>
            )}
          </div>
          {peek?.id === s.id && <iframe title={W.peek} sandbox="allow-scripts" srcDoc={peek.html} className="h-56 w-full rounded-lg border-2 border-ink bg-white" />}
        </div>
      ))}
    </Slip>
  );
}

function Hints({ tile, live }: { tile: TileView; live: boolean }) {
  return (
    <Slip className="flex flex-col gap-2 p-3">
      {tile.hintsUsed.map((h, i) => (
        <p key={i} className="text-sm font-bold">
          💡 {h}
        </p>
      ))}
      {tile.hintsLeft > 0 && (
        <Btn size="sm" tone="yellow" disabled={!live} onClick={() => vcAct(EVC.hintUse, { tileId: tile.id })}>
          {W.hint} · {W.hintsLeft(tile.hintsLeft)}
        </Btn>
      )}
    </Slip>
  );
}
