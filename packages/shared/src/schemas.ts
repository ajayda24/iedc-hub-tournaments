import { z } from "zod";
import type { CheatPayload, EventConfig, HelloPayload, JoinPayload } from "./protocol";

/* ------------------------------------------------------------------ */
/* Inbound payload validation                                          */
/* ------------------------------------------------------------------ */

const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const helloSchema: z.ZodType<HelloPayload> = z.object({
  role: z.enum(["player", "host", "screen"]),
  token: z.string().max(64).optional(),
  pin: z.string().max(12).optional(),
});

export const joinSchema: z.ZodType<JoinPayload> = z.object({
  token: z.string().min(8).max(64),
  name: trimmed(40),
  sem: trimmed(8),
  dept: trimmed(24),
  avatar: z.number().int().min(0).max(1_000_000),
});

export const submitSchema = z.object({
  roundId: z.string().max(40),
  sub: z.unknown(),
});

export const cheatSchema: z.ZodType<CheatPayload> = z.object({
  kind: z.enum(["internet", "focus"]),
  detail: z.string().max(120).optional(),
  ms: z.number().nonnegative().max(3_600_000).optional(),
});

const roundOptionsSchema = z
  .object({
    pack: z.string().max(24).optional(),
    customWords: z.array(z.string().max(16)).max(60).optional(),
  })
  .optional();

export const roundConfigSchema = z.object({
  id: z.string().min(1).max(40),
  game: z.enum(["sudoku", "wordhunt", "anagram", "numbercrunch"]),
  difficulty: z.enum(["easy", "med", "hard"]),
  timeLimitSec: z.number().int().min(20).max(1800),
  options: roundOptionsSchema,
});

export const eventConfigSchema: z.ZodType<EventConfig> = z.object({
  eventName: trimmed(60),
  format: z.enum(["classic", "knockout"]),
  knockoutPct: z.number().int().min(5).max(75),
  rounds: z.array(roundConfigSchema).max(50),
  strikePenaltyAt: z.number().int().min(1).max(10),
  strikeLockAt: z.number().int().min(1).max(10),
  blockInternet: z.boolean(),
});

export const idSchema = z.object({ id: z.string().max(40) });
export const adjustSchema = z.object({ id: z.string().max(40), delta: z.number().int().min(-100000).max(100000) });
export const startSchema = z.object({ index: z.number().int().min(0).max(49).optional() }).optional();
export const resetSchema = z.object({ keepPlayers: z.boolean() });

