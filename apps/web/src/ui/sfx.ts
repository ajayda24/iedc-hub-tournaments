"use client";
import { store } from "@/lib/storage";

/** Tiny synthesised sound effects — no audio files to download over the hotspot. */
let ctx: AudioContext | null = null;
let enabled: boolean | null = null;

export function soundOn(defaultOn = false): boolean {
  if (enabled === null) enabled = store.get("ba:sound", defaultOn);
  return enabled;
}
export function setSound(on: boolean) {
  enabled = on;
  store.set("ba:sound", on);
  if (on) unlock();
}
function unlock() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = "triangle", gain = 0.12, slideTo?: number, delay = 0) {
  if (!soundOn()) return;
  unlock();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  tap: () => tone(660, 0.05, "square", 0.04),
  pop: () => tone(520, 0.12, "triangle", 0.12, 900),
  buzz: () => tone(140, 0.25, "sawtooth", 0.08, 90),
  count: () => tone(440, 0.12, "square", 0.08),
  go: () => tone(880, 0.3, "square", 0.1, 1320),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, "triangle", 0.12, undefined, i * 0.09)),
  tick: () => tone(1200, 0.03, "square", 0.03),
  alarm: () => [0, 0.18, 0.36].forEach((d) => tone(980, 0.12, "square", 0.08, 700, d)),
};
