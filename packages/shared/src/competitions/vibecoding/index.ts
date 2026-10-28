import type { CompetitionDefinition } from "../types";
import { COMPETITIONS } from "../registry";
import { applyAction, createTeamState, type Action, type Ctx, type TeamInit } from "./rules";
import { teamScore } from "./scoring";
import { createState, type CompetitionState, type Team } from "./state";
import { teamView } from "./views";
import type { TeamView } from "./protocol";

/** Vibe Hackathon ("vibecoding"): the pure rules, plugged into the competition contract. */
export const vibecoding: CompetitionDefinition<CompetitionState, Team, TeamInit, Action, Ctx, TeamView> = {
  meta: COMPETITIONS.vibecoding,
  createState,
  createTeamState,
  applyAction,
  score: (s, teamId) => teamScore(s, s.teams[teamId]),
  boardView: (s, teamId, now) => teamView(s, s.teams[teamId], { now, online: new Set(), internet: new Set() }),
};
