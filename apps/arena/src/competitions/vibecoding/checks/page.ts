import { JSDOM, VirtualConsole } from "jsdom";
import { DEFAULT_CHECK_START, type CheckPage } from "@iedc/shared/competitions/vibecoding/checks";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface PageOptions {
  /** fake clock start (ISO or epoch ms) */
  start?: string | number;
  /** id of the <section> the hooks are looked up in */
  sectionId: string;
  css: string;
  html: string;
  teamName: string;
}

const toMs = (t: string | number) => (typeof t === "number" ? t : new Date(t).getTime());

/**
 * A page for the checks: jsdom with scripts on, a fake clock installed before
 * any script runs, and every network API stubbed out. Never served to anyone.
 */
export function makePage(source: string, opts: PageOptions): { page: CheckPage; close(): void } {
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (e: Error) => {
    if (!/Not implemented/i.test(e.message)) errors.push(e.message.slice(0, 300));
  });
  let clock!: CheckPage["clock"];
  const dom = new JSDOM(source, {
    runScripts: "dangerously",
    url: "http://site.local/",
    virtualConsole,
    beforeParse(w) {
      clock = installFakeTime(w as any, toMs(opts.start ?? DEFAULT_CHECK_START), errors);
      stubWindow(w as any);
    },
  });
  const w = dom.window as unknown as Window & typeof globalThis;
  const d = w.document;
  const section = d.getElementById(opts.sectionId) as HTMLElement | null;
  const scope = (): ParentNode => section ?? d;

  const page: CheckPage = {
    window: w,
    document: d,
    section,
    hook: (name) => scope().querySelector(`[data-hook="${cssEscape(name)}"]`) as HTMLElement | null,
    hooks: (name) => [...scope().querySelectorAll(`[data-hook="${cssEscape(name)}"]`)] as HTMLElement[],
    css: opts.css,
    html: opts.html,
    clock,
    errors,
    teamName: opts.teamName,
    click(el) {
      if (!el) return;
      try {
        (el as HTMLElement).click();
      } catch (e) {
        errors.push(String(e));
      }
    },
    submit(form) {
      if (!form) return;
      const before = d.body.innerHTML;
      if (form.tagName === "FORM") form.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
      // nothing reacted to the submit event: maybe the button has a click handler instead
      if (d.body.innerHTML === before) {
        const btn = form.querySelector('button[type="submit"],button:not([type]),input[type="submit"],button');
        if (btn) (btn as HTMLElement).click();
      }
    },
    setValue(el, value) {
      if (!el) return;
      (el as HTMLInputElement).value = value;
      el.dispatchEvent(new w.Event("input", { bubbles: true }));
      el.dispatchEvent(new w.Event("change", { bubbles: true }));
    },
  };
  return {
    page,
    close: () => {
      try {
        dom.window.close();
      } catch {
        /* ignore */
      }
    },
  };
}

const cssEscape = (s: string) => s.replace(/["\\]/g, "\\$&");

/** Date, timers and animation frames all run on a clock the checks control. */
function installFakeTime(w: any, start: number, errors: string[]): CheckPage["clock"] {
  let now = start;
  let seq = 1;
  const timers = new Map<number, { at: number; fn: unknown; args: unknown[]; every: number | null }>();
  const RealDate = w.Date;
  function FakeDate(this: unknown, ...a: unknown[]) {
    if (!new.target) return new RealDate(now).toString();
    return a.length ? new RealDate(...a) : new RealDate(now);
  }
  FakeDate.prototype = RealDate.prototype;
  FakeDate.now = () => now;
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  w.Date = FakeDate;

  const add = (fn: unknown, ms: unknown, args: unknown[], repeat: boolean) => {
    const id = seq++;
    const delay = Math.max(0, Number(ms) || 0);
    timers.set(id, { at: now + delay, fn, args, every: repeat ? Math.max(1, delay) : null });
    return id;
  };
  w.setTimeout = (fn: unknown, ms?: unknown, ...args: unknown[]) => add(fn, ms, args, false);
  w.setInterval = (fn: unknown, ms?: unknown, ...args: unknown[]) => add(fn, ms, args, true);
  w.clearTimeout = w.clearInterval = (id: number) => void timers.delete(id);
  w.requestAnimationFrame = (fn: (t: number) => void) => add(() => fn(now - start), 16, [], false);
  w.cancelAnimationFrame = (id: number) => void timers.delete(id);
  try {
    Object.defineProperty(w.performance, "now", { value: () => now - start, configurable: true });
  } catch {
    /* ignore */
  }

  return {
    now: () => now,
    set: (t) => {
      now = toMs(t);
    },
    advance(ms) {
      const target = now + Math.max(0, ms);
      for (let guard = 0; guard < 20_000; guard++) {
        let next: [number, { at: number; fn: unknown; args: unknown[]; every: number | null }] | null = null;
        for (const e of timers) if (e[1].at <= target && (!next || e[1].at < next[1].at || (e[1].at === next[1].at && e[0] < next[0]))) next = e;
        if (!next) break;
        const [id, t] = next;
        now = Math.max(now, t.at);
        if (t.every != null) t.at += t.every;
        else timers.delete(id);
        if (typeof t.fn !== "function") continue;
        try {
          (t.fn as (...a: unknown[]) => void)(...t.args);
        } catch (e) {
          errors.push(`Uncaught ${String(e)}`.slice(0, 300));
        }
      }
      now = target;
    },
  };
}

/** No network, no popups, and the browser APIs jsdom lacks (so harmless code doesn't crash). */
function stubWindow(w: any) {
  const offline = () => {
    throw new Error("The network is off in Vibe Hackathon checks");
  };
  w.fetch = () => Promise.reject(new Error("The network is off in Vibe Hackathon checks"));
  w.XMLHttpRequest = function XMLHttpRequest() {
    offline();
  };
  w.WebSocket = function WebSocket() {
    offline();
  };
  w.EventSource = function EventSource() {
    offline();
  };
  if (w.navigator) {
    try {
      Object.defineProperty(w.navigator, "sendBeacon", { value: () => false, configurable: true });
    } catch {
      /* ignore */
    }
  }
  w.alert = () => {};
  w.confirm = () => true;
  w.prompt = () => null;
  w.open = () => null;
  w.print = () => {};
  w.scrollTo = w.scrollBy = w.scroll = () => {};
  w.matchMedia = (q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false });
  class NoopObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  w.IntersectionObserver = NoopObserver;
  w.ResizeObserver = NoopObserver;
  if (w.Element?.prototype) w.Element.prototype.scrollIntoView = function () {};
  if (w.HTMLCanvasElement?.prototype) w.HTMLCanvasElement.prototype.getContext = () => null;
  if (w.HTMLMediaElement?.prototype) {
    w.HTMLMediaElement.prototype.play = () => Promise.resolve();
    w.HTMLMediaElement.prototype.pause = () => {};
  }
}
