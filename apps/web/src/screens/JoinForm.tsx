"use client";
import { useState, type FormEvent } from "react";
import { EV, type JoinAck, type StudentCheckAck } from "@iedc/shared/protocol";
import { DEPARTMENTS, OTHER_DEPARTMENT, SEMESTERS } from "@iedc/data/people";
import { PIN, STUDENT_ID } from "@iedc/data/rules";
import { site } from "@iedc/data/site";
import { join as t } from "@iedc/data/copy/join";
import { emitAck, useArena } from "@/net/arena";
import { deviceToken, store, type Profile } from "@/lib/storage";
import { cx } from "@/lib/format";
import { Avatar, randomAvatar } from "@/ui/Avatar";
import { Btn, Hand, Slip } from "@/ui/kit";
import { Mascot } from "@/ui/Mascot";
import { Credits } from "@/ui/Credits";

const cleanId = (v: string) => v.replace(/\s+/g, "").toUpperCase().slice(0, STUDENT_ID.maxLength);
const pinOk = (v: string) => new RegExp(`^\\d{${PIN.length}}$`).test(v);

export function JoinForm() {
  const eventName = useArena((s) => s.state?.eventName ?? site.defaultEventName);
  const saved = store.get<Profile | null>("ba:profile", null);
  const [step, setStep] = useState<"details" | "pin">("details");
  const [studentId, setStudentId] = useState(saved?.studentId ?? "");
  const [name, setName] = useState(saved?.name ?? "");
  const [sem, setSem] = useState(saved?.sem ?? "");
  const [dept, setDept] = useState(saved?.dept && DEPARTMENTS.includes(saved.dept) ? saved.dept : saved?.dept ? OTHER_DEPARTMENT : "");
  const [otherDept, setOtherDept] = useState(saved?.dept && !DEPARTMENTS.includes(saved.dept) ? saved.dept : "");
  const [avatar, setAvatar] = useState(saved?.avatar ?? randomAvatar());
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finalDept = dept === OTHER_DEPARTMENT ? otherDept.trim() : dept;

  /* step 1 → ask the arena whether this Student ID already has a PIN */
  const next = async () => {
    const id = cleanId(studentId);
    const problem = name.trim().length < 2 ? t.needName : !id ? t.needStudentId : !sem ? t.needSemester : !finalDept ? t.needDepartment : null;
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    store.set("ba:profile", { studentId: id, name: name.trim(), sem, dept: finalDept, avatar } satisfies Profile);
    try {
      const res = await emitAck<StudentCheckAck>(EV.studentCheck, { studentId: id });
      if (!res.ok) return setError(res.error ?? t.couldNotJoin);
      setStudentId(id);
      setHasPin(!!res.exists);
      setPin("");
      setPin2("");
      setStep("pin");
    } catch {
      setError(t.noAnswer);
    } finally {
      setBusy(false);
    }
  };

  /* step 2 → create or check the PIN and join */
  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (!pinOk(pin)) return setError(t.pinNeedsDigits(PIN.length));
    if (!hasPin && pin !== pin2) return setError(t.pinMismatch);
    setBusy(true);
    setError(null);
    try {
      const res = await emitAck<JoinAck>(EV.join, {
        token: deviceToken(),
        studentId,
        pin,
        name: name.trim(),
        sem,
        dept: finalDept,
        avatar,
      });
      if (!res.ok) {
        setError(res.error ?? t.couldNotJoin);
        setPin("");
      } else useArena.setState({ me: res.me ?? null });
    } catch {
      setError(t.noAnswer);
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <header className="flex items-end gap-3">
      <Mascot mood={step === "pin" ? "think" : "happy"} size={70} />
      <div>
        <Hand className="text-lg">{t.welcome}</Hand>
        <h1 className="text-3xl font-black leading-none">
          <span className="hl">{eventName}</span>
        </h1>
      </div>
    </header>
  );

  if (step === "pin") {
    const pinInput = (value: string, set: (v: string) => void, label: string, autoComplete: string, autoFocus = false) => (
      <label className="flex flex-col gap-1.5">
        <span className="font-bold">{label}</span>
        <input
          className="field text-center text-3xl tracking-[0.5em]"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={PIN.length}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, PIN.length))}
        />
      </label>
    );
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 pb-10 pt-6">
        {header}
        {/* a real form with a username field so browsers offer to save / fill the PIN */}
        <form onSubmit={join} className="flex flex-col gap-5" autoComplete="on">
          <input type="text" name="username" autoComplete="username" value={studentId} readOnly hidden />
          <Slip taped className="flex flex-col gap-4 px-4 pb-5 pt-6" tilt={0.5}>
            <div>
              <div className="text-2xl font-black">{hasPin ? t.enterPinTitle : t.createPinTitle}</div>
              <p className="text-sm font-semibold text-ink-soft">{hasPin ? t.enterPinBody(studentId) : t.createPinBody(studentId)}</p>
            </div>
            {pinInput(pin, setPin, t.pinLabel(PIN.length), hasPin ? "current-password" : "new-password", true)}
            {!hasPin && pinInput(pin2, setPin2, t.confirmPinLabel, "new-password")}
          </Slip>

          {!hasPin && (
            <div className="slip flex gap-3 !bg-yellow px-4 py-3" role="note">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-ink bg-card font-black">i</span>
              <div>
                <div className="font-black">{t.saveInfoTitle}</div>
                <p className="text-sm font-semibold">{t.saveInfoBody}</p>
              </div>
            </div>
          )}

          {error && <p className="hand -my-2 text-center text-xl text-stamp">{error}</p>}

          <button type="submit" className="sticker w-full !px-6 !py-3.5 text-lg" style={{ background: "var(--color-mint)" }} disabled={busy}>
            {busy ? t.joiningButton : hasPin ? t.enterButton : t.createButton}
          </button>
          <Btn
            tone="paper"
            size="sm"
            className="self-center"
            onClick={() => {
              setStep("details");
              setError(null);
            }}
          >
            {t.backButton}
          </Btn>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 pb-10 pt-6">
      {header}

      <Slip taped className="flex flex-col gap-4 px-4 pb-5 pt-6" tilt={-0.6}>
        <label className="flex flex-col gap-1.5">
          <span className="font-bold">{t.nameLabel}</span>
          <input
            className="field"
            autoComplete="name"
            maxLength={40}
            placeholder={t.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-bold">
            {t.studentIdLabel} <span className="hand font-normal text-pencil">({t.studentIdHint})</span>
          </span>
          <input
            className="field font-mono uppercase tracking-wider"
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={STUDENT_ID.maxLength}
            placeholder={t.studentIdPlaceholder}
            value={studentId}
            onChange={(e) => setStudentId(cleanId(e.target.value))}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="font-bold">{t.semesterLabel}</span>
          <div className="grid grid-cols-4 gap-2">
            {SEMESTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSem(s)}
                className={cx("sticker !px-0 !py-2 !shadow-[2px_2px_0_0_var(--color-ink)]", sem === s ? "" : "!bg-card")}
                data-pressed={sem === s}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-bold">{t.departmentLabel}</span>
          <div className="flex flex-wrap gap-2">
            {DEPARTMENTS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDept(d)}
                className={cx("chip !px-3 !py-1.5 transition-transform", dept === d ? "-rotate-2 !bg-mint" : "")}
              >
                {d}
              </button>
            ))}
          </div>
          {dept === OTHER_DEPARTMENT && (
            <input className="field mt-1" maxLength={24} placeholder={t.otherDeptPlaceholder} value={otherDept} onChange={(e) => setOtherDept(e.target.value)} />
          )}
        </div>

        <div className="flex items-center gap-4">
          <Avatar seed={avatar} size={64} />
          <div className="flex-1">
            <span className="font-bold">{t.avatarTitle}</span>
            <Hand className="block text-base">{t.avatarHint}</Hand>
          </div>
          <Btn size="sm" tone="sky" onClick={() => setAvatar(randomAvatar())}>
            {t.shuffle}
          </Btn>
        </div>
      </Slip>

      {error && <p className="hand -my-2 text-center text-xl text-stamp">{error}</p>}

      <Btn size="lg" tone="mint" onClick={next} disabled={busy} className="w-full">
        {busy ? t.checking : t.nextButton}
      </Btn>
      <Hand className="text-center">{t.noSignupNote}</Hand>
      <Credits className="mt-auto" />
    </main>
  );
}
