/**
 * A competition is a long, team-based event that runs next to the weekly games
 * (its own pages under /competitions/<id>/, its own Socket.IO namespace and its
 * own saved state). Adding one = a folder per layer + an entry in registry.ts.
 */
export interface CompetitionMeta {
  id: string;
  title: string;
  subtitle: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * The pure part of a competition. The arena owns async work (AI calls, checks,
 * publishing) and feeds the results back in as actions, so every rule lives in
 * one deterministic, testable place.
 */
export interface CompetitionDefinition<State, Team, TeamInit, Action, Ctx, BoardView> {
  meta: CompetitionMeta;
  createState(seed: number, now: number): State;
  createTeamState(seed: number, init: TeamInit): Team;
  applyAction(state: State, action: Action, ctx: Ctx): ActionResult;
  score(state: State, teamId: string): { total: number };
  boardView(state: State, teamId: string, now: number): BoardView;
}
