import type { SubmitAck } from "@iedc/shared/protocol";

export interface ViewProps<Pub, Prog> {
  pub: Pub;
  /** latest progress the server (or practice engine) knows about */
  progress: Prog;
  /** solved / failed / locked / timed out: read-only */
  done: boolean;
  /** paused or blocked by anti-cheat: no input for now */
  frozen: boolean;
  submit: (sub: unknown) => Promise<SubmitAck>;
}
