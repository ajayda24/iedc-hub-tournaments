import { z } from "zod";
import { STUDENT_ID } from "@iedc/data/rules";
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

/** Student ID: trimmed, spaces removed, upper-cased; only the max length is checked (data/rules.ts) */
export const studentIdSchema = z
  .string()
  .transform((v) => v.replace(/\s+/g, "").toUpperCase())
  .pipe(z.string().min(1).max(STUDENT_ID.maxLength));

export const joinSchema: z.ZodType<JoinPayload, any> = z.object({
  token: z.string().min(8).max(64),
  studentId: studentIdSchema,
  pin: z.string().max(12),
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


export const studentCheckSchema = z.object({ studentId: studentIdSchema });
export const studentRefSchema = z.object({ studentId: z.string().max(40) });
export const historyEditSchema = z.object({
  id: z.string().max(40),
  included: z.boolean().optional(),
  name: z.string().trim().min(1).max(60).optional(),
  remove: z.boolean().optional(),
});
const historyPlayerSchema = z.object({
  studentId: z.string().max(40),
  name: z.string().max(60),
  dept: z.string().max(40),
  sem: z.string().max(12),
  score: z.number(),
  rank: z.number().int(),
  solves: z.number().int(),
});
export const historyImportSchema = z.object({
  tournaments: z
    .array(
      z.object({
        id: z.string().max(40),
        name: z.string().max(60),
        date: z.number(),
        month: z.string().regex(/^\d{4}-\d{2}$/),
        included: z.boolean(),
        players: z.array(historyPlayerSchema).max(2000),
      }),
    )
    .max(5000),
});
