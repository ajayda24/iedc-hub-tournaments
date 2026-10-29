import { hooksFor, tileConfig, type TileId, type Variant } from "@iedc/shared/competitions/vibecoding/config";
import { CR_HOOK } from "@iedc/shared/competitions/vibecoding/tiles/index";
import type { Fragment } from "@iedc/shared/competitions/vibecoding/state";

export interface PromptInput {
  tileId: TileId;
  variant: Variant;
  fragment: Fragment;
  notes: string;
  teamName: string;
  /** the student's Ask */
  ask: string;
  /** the client's change request is active: give the AI its hook */
  changeRequest?: boolean;
}

export interface Prompt {
  system: string;
  user: string;
  /** for the mock provider and logs */
  tileId: TileId;
  teamName: string;
}

/**
 * The hidden system prompt (spec 6.2). The checklist is never sent: the
 * requirements must come from the student's Ask. Only hook names (with what
 * they mean) are given, so the checks can find things.
 */
export function buildPrompt(input: PromptInput): Prompt {
  const t = tileConfig(input.tileId);
  const hooks = { ...hooksFor(input.tileId, input.variant) };
  if (input.changeRequest) hooks[CR_HOOK] = "a line or banner with the client's message, if the user asks for one";
  const hookLines = Object.entries(hooks)
    .map(([name, meaning]) => `  data-hook="${name}": ${meaning}`)
    .join("\n");
  const scope = input.tileId === "theme" ? "Scope CSS under #tile-theme, except dark-mode rules on body or html. JS must run inside an IIFE; it may only change this section and the class or data attributes of <html>/<body>." : `Scope all CSS under #tile-${input.tileId}. JS must run inside an IIFE and only touch this section.`;
  const system = `You help beginners build one section of an event web page.
Section: ${t.title} (id: ${input.tileId}). The team is called "${input.teamName}".
The user may write in English, Malayalam or Manglish. Reply in the same
language in at most 2 short sentences, then give the code.
Rules:
- Output exactly three blocks: <html>...</html>, <css>...</css>, <js>...</js>.
  Each block holds the COMPLETE code of this section after your change: start from
  the current code below, change only what the user asked, and repeat everything
  else unchanged. Never drop existing styles or scripts. No markdown fences, no other code.
- Write only the inner HTML of this section (no <html>, <head>, <body>,
  no <section> wrapper). ${scope}
- No external files, libraries, fonts, images or network calls. Use emoji or CSS.
- Do not use localStorage, sessionStorage, cookies, fetch or eval.
- Use these CSS variables from the page: --bg, --fg, --accent, --card.
- Add these data-hook attributes where they apply:
${hookLines}${t.aiNotes ? `\n- ${t.aiNotes}` : ""}
- Keep the code simple and readable.
Project Notes from the team: ${input.notes.trim() || "(none)"}
Current code of this section:
<html>${input.fragment.html}</html><css>${input.fragment.css}</css><js>${input.fragment.js}</js>`;
  return { system, user: input.ask, tileId: input.tileId, teamName: input.teamName };
}

/** Rough input-token estimate for the TPM limit (characters / 4). */
export const estimateTokens = (p: Prompt) => Math.ceil((p.system.length + p.user.length) / 4);
