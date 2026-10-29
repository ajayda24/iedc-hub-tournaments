import { z } from "zod";
import { joinSchema, studentIdSchema } from "../../schemas";
import { PHASES } from "./state";

/** Inbound payload validation for the /competitions namespace. The server never trusts a phone. */

const tileId = z.enum(["warmup", "hero", "countdown", "schedule", "register", "theme", "gallery", "feedback", "fixit"]);
const scoredTileId = z.enum(["hero", "countdown", "schedule", "register", "theme", "gallery", "feedback", "fixit"]);

export const cHelloSchema = z.object({
  competition: z.string().max(40),
  role: z.enum(["player", "host", "screen"]),
  token: z.string().max(64).optional(),
  pin: z.string().max(12).optional(),
});

/** Same fields as the weekly join form. */
export const cJoinSchema = joinSchema;
export const cStudentCheckSchema = z.object({ studentId: studentIdSchema });

export const teamNameSchema = z
  .string()
  .transform((v) => v.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(2).max(24));

export const teamCreateSchema = z.object({ name: teamNameSchema });
export const teamJoinSchema = z.object({
  code: z
    .string()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .pipe(z.string().length(4)),
});
export const teamKickSchema = z.object({ studentId: z.string().max(40) });
export const teamRenameSchema = z.object({ name: teamNameSchema });
export const readySchema = z.object({ ready: z.boolean() });

export const tileRefSchema = z.object({ tileId });
export const askSchema = z.object({ tileId, text: z.string().trim().min(1).max(600) });
export const saveCreateSchema = z.object({ tileId, note: z.string().trim().max(80).optional() });
export const codeEditSchema = z.object({ tileId, html: z.string().max(20_000), css: z.string().max(20_000), js: z.string().max(20_000) });
export const savePreviewSchema = z.object({ tileId, saveId: z.string().max(24) });
export const saveRestoreSchema = z.object({ tileId, saveId: z.string().max(24) });
export const notesSchema = z.object({ notes: z.string().max(500) });
export const puzzleMoveSchema = z.object({ cell: z.number().int().min(0).max(8), version: z.number().int().min(0) });
export const voteSchema = z.object({ teamId: z.string().max(24) });
export const internetSchema = z.object({ online: z.boolean() });

/* ---------------- host ---------------- */

export const hostSettingsSchema = z.object({
  buildMinutes: z.number().int().min(10).max(300).optional(),
  glitch: z.boolean().optional(),
  minTeamSize: z.number().int().min(1).max(6).optional(),
  maxTeamSize: z.number().int().min(1).max(6).optional(),
  maxTeams: z.number().int().min(1).max(40).optional(),
  registrationLocked: z.boolean().optional(),
  variants: z.record(scoredTileId, z.enum(["full", "simple"])).optional(),
  safeMode: z.boolean().optional(),
  allowHostInternet: z.boolean().optional(),
  logPrompts: z.boolean().optional(),
  allowCodeEdit: z.boolean().optional(),
});
export const hostPhaseSchema = z.object({ phase: z.enum(PHASES as [string, ...string[]]) });
export const hostExtendSchema = z.object({ minutes: z.number().int().min(1).max(60) });
export const hostMemberSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("rename"), studentId: z.string().max(40), name: z.string().trim().min(1).max(40) }),
  z.object({ op: z.literal("move"), studentId: z.string().max(40), teamId: z.string().max(24) }),
  z.object({ op: z.literal("remove"), studentId: z.string().max(40) }),
]);
export const hostTeamSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("unlockTile"), teamId: z.string().max(24), tileId: scoredTileId }),
  z.object({ op: z.literal("reset"), teamId: z.string().max(24) }),
  z.object({ op: z.literal("remove"), teamId: z.string().max(24) }),
  z.object({ op: z.literal("rename"), teamId: z.string().max(24), name: teamNameSchema }),
  z.object({ op: z.literal("message"), teamId: z.string().max(24), text: z.string().trim().max(200) }),
  z.object({ op: z.literal("glitchFire"), teamId: z.string().max(24) }),
  z.object({ op: z.literal("glitchCancel"), teamId: z.string().max(24) }),
]);
export const hostModelSchema = z.object({ id: z.string().max(80), disabled: z.boolean() });
export const hostGeminiKeySchema = z.object({ key: z.string().trim().max(200) });
export const hostShowcaseSchema = z.object({ teamId: z.string().max(24).nullable(), voting: z.boolean().optional() });
export const hostSpotlightSchema = z.object({ teamId: z.string().max(24).nullable() });
