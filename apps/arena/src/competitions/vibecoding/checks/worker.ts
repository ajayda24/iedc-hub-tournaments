import { parentPort } from "node:worker_threads";
import { runJob, type CheckJob } from "./run";

/**
 * The check runner's worker thread. Student code runs in jsdom here, never in
 * the arena's main thread: the arena kills this thread if it overruns its time
 * or memory, and starts a new one.
 */
parentPort?.on("message", (msg: { id: number; job: CheckJob }) => {
  try {
    parentPort!.postMessage({ id: msg.id, ok: true, result: runJob(msg.job) });
  } catch (e) {
    parentPort!.postMessage({ id: msg.id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
parentPort?.postMessage({ ready: true });
