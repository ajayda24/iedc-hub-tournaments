"use client";
import { useState } from "react";
import { DEPARTMENTS, EV, SEMESTERS, type JoinAck } from "@iedc/shared/protocol";
import { emitAck, useArena } from "@/net/arena";
import { deviceToken, store, type Profile } from "@/lib/storage";
import { cx } from "@/lib/format";
import { Avatar, randomAvatar } from "@/ui/Avatar";
import { Btn, Hand, Slip } from "@/ui/kit";
import { Mascot } from "@/ui/Mascot";

export function JoinForm() {
  const eventName = useArena((s) => s.state?.eventName ?? "Brain Arena");
  const saved = store.get<Profile | null>("ba:profile", null);
  const [name, setName] = useState(saved?.name ?? "");
  const [sem, setSem] = useState(saved?.sem ?? "");
  const [dept, setDept] = useState(saved?.dept && DEPARTMENTS.includes(saved.dept) ? saved.dept : saved?.dept ? "Other" : "");
  const [otherDept, setOtherDept] = useState(saved?.dept && !DEPARTMENTS.includes(saved.dept) ? saved.dept : "");
  const [avatar, setAvatar] = useState(saved?.avatar ?? randomAvatar());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finalDept = dept === "Other" ? otherDept.trim() : dept;
  const ready = name.trim().length >= 2 && sem && finalDept;

  const join = async () => {
    if (!ready) {
      setError(name.trim().length < 2 ? "Your full name, please." : !sem ? "Pick your semester." : "Pick your department.");
      return;
    }
    setBusy(true);
    setError(null);
    const profile: Profile = { name: name.trim(), sem, dept: finalDept, avatar };
    store.set("ba:profile", profile);
    try {
      const res = await emitAck<JoinAck>(EV.join, { token: deviceToken(), ...profile });
      if (!res.ok) setError(res.error ?? "Couldn't join.");
      else useArena.setState({ me: res.me ?? null });
    } catch {
      setError("The arena didn't answer. Are you on the event Wi-Fi?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 pb-10 pt-6">
      <header className="flex items-end gap-3">
        <Mascot mood="happy" size={70} />
        <div>
          <Hand className="text-lg">welcome to</Hand>
          <h1 className="text-3xl font-black leading-none">
            <span className="hl">{eventName}</span>
          </h1>
        </div>
      </header>

      <Slip taped className="flex flex-col gap-4 px-4 pb-5 pt-6" tilt={-0.6}>
        <label className="flex flex-col gap-1.5">
          <span className="font-bold">Full name</span>
          <input
            className="field"
            autoComplete="name"
            maxLength={40}
            placeholder="e.g. Anjali Nair"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="font-bold">Semester</span>
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
          <span className="font-bold">Department</span>
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
          {dept === "Other" && (
            <input className="field mt-1" maxLength={24} placeholder="Your department" value={otherDept} onChange={(e) => setOtherDept(e.target.value)} />
          )}
        </div>

        <div className="flex items-center gap-4">
          <Avatar seed={avatar} size={64} />
          <div className="flex-1">
            <span className="font-bold">Your face tonight</span>
            <Hand className="block text-base">tap shuffle until it feels right</Hand>
          </div>
          <Btn size="sm" tone="sky" onClick={() => setAvatar(randomAvatar())}>
            Shuffle
          </Btn>
        </div>
      </Slip>

      {error && <p className="hand -my-2 text-center text-xl text-stamp">{error}</p>}

      <Btn size="lg" tone="mint" onClick={join} disabled={busy} className="w-full">
        {busy ? "Joining…" : "Jump in →"}
      </Btn>
      <Hand className="text-center">No sign-up. Your score sticks to this phone, so don&apos;t switch devices.</Hand>
    </main>
  );
}
