"use client";
import { useEffect } from "react";
import { Mascot } from "@/ui/Mascot";
import { Btn } from "@/ui/kit";
import { sfx } from "@/ui/sfx";
import type { Strike } from "./useAntiCheat";

export function InternetBlock() {
  useEffect(() => sfx.alarm(), []);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-paper/95 p-6 backdrop-blur-[2px]" role="alertdialog" aria-live="assertive">
      <div className="slip taped max-w-sm px-6 pb-6 pt-8 text-center" style={{ transform: "rotate(-1deg)" }}>
        <Mascot mood="shock" size={110} className="mx-auto" />
        <h2 className="mt-2 text-3xl font-black">
          Caught you <span className="hl" style={{ ["--hl" as string]: "var(--color-coral)" }}>online</span>
        </h2>
        <p className="mt-3 font-semibold">Your phone can reach the internet. That&apos;s not allowed during the event.</p>
        <ol className="mt-3 list-decimal space-y-1 pl-6 text-left">
          <li>Turn OFF mobile data</li>
          <li>Turn off any VPN</li>
          <li>Stay on the event Wi-Fi only</li>
        </ol>
        <p className="hand mt-4 text-lg text-pencil">The game unfreezes by itself once you&apos;re offline. The host has been told.</p>
      </div>
    </div>
  );
}

const STRIKE_TEXT: Record<Strike["action"], [string, string]> = {
  warn: ["Strike one!", "You left the game. Next time it costs 200 points."],
  penalty: ["−200 points", "Your brain left the tab. Stay put!"],
  lock: ["Locked out", "Too many strikes this round. Talk to the host."],
  noted: ["", ""],
};

export function StrikeBanner({ strike, onClose }: { strike: Strike; onClose: () => void }) {
  useEffect(() => {
    sfx.buzz();
    const t = setTimeout(onClose, strike.action === "lock" ? 9000 : 5000);
    return () => clearTimeout(t);
  }, [strike, onClose]);
  const [title, body] = strike.kind === "internet" ? ["Internet detected", "That's a strike. Mobile data off, please."] : STRIKE_TEXT[strike.action];
  return (
    <div className="fixed inset-x-3 top-3 z-[55] mx-auto max-w-md animate-pop">
      <div className="slip flex items-center gap-3 !bg-coral px-4 py-3">
        <Mascot mood="dizzy" size={44} bob={false} />
        <div className="flex-1">
          <div className="text-lg font-black">{title}</div>
          <div className="text-sm font-semibold">{body}</div>
        </div>
        <Btn size="sm" tone="paper" onClick={onClose}>
          ok
        </Btn>
      </div>
    </div>
  );
}
