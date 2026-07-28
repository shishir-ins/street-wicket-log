import type { Database } from "@/integrations/supabase/types";

export type Player = Database["public"]["Tables"]["players"]["Row"];
export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type Ball = Database["public"]["Tables"]["balls"]["Row"];

export type PlayerRole = "Batsman" | "Bowler" | "All-rounder" | "Wicket Keeper";
export const PLAYER_ROLES: PlayerRole[] = ["Batsman", "Bowler", "All-rounder", "Wicket Keeper"];

export type Team = "A" | "B";

export interface MatchState {
  innings: 1 | 2;
  battingTeam: Team;
  bowlingTeam: Team;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  ballIndex: number;
  outBatsmen: string[];
  isPaused?: boolean;
  pauseReason?: "innings_break" | "match_break";
  target?: number | null;
  /** When an innings is declared/forfeited mid-overs, this caps the next innings to the same number of legal balls. */
  inningsBallsCap?: number | null;
  declared?: boolean;
}

export interface InningsTotals {
  runs: number;
  wickets: number;
  legalBalls: number;
  extras: number;
  fours: number;
  sixes: number;
}

export const emptyInnings = (): InningsTotals => ({
  runs: 0, wickets: 0, legalBalls: 0, extras: 0, fours: 0, sixes: 0,
});

export function computeInningsTotals(balls: Ball[], innings: number): InningsTotals {
  const t = emptyInnings();
  for (const b of balls) {
    if (b.innings_number !== innings) continue;
    t.runs += (b.runs ?? 0) + (b.extra_runs ?? 0);
    if (b.is_legal_ball) t.legalBalls += 1;
    if (!b.is_legal_ball) t.extras += b.extra_runs ?? 0;
    if (b.extra_type === "bye" || b.extra_type === "leg_bye" || b.extra_type === "declared") t.extras += b.extra_runs ?? 0;
    if (b.is_wicket) t.wickets += 1;
    if (!b.extra_type && b.runs === 4) t.fours += 1;
    if (!b.extra_type && b.runs === 6) t.sixes += 1;
  }
  return t;
}

export function oversString(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6);
  const remBalls = legalBalls % 6;
  return `${overs}.${remBalls}`;
}

export function runRate(runs: number, legalBalls: number): number {
  if (legalBalls === 0) return 0;
  return (runs * 6) / legalBalls;
}

export function requiredRunRate(target: number, currentRuns: number, totalBalls: number, ballsBowled: number): number {
  const remBalls = totalBalls - ballsBowled;
  if (remBalls <= 0) return 0;
  const remRuns = Math.max(0, target - currentRuns);
  return (remRuns * 6) / remBalls;
}

// Per-player aggregated stats over a given set of balls
export interface BattingLine {
  playerId: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  out: boolean;
  dismissal?: string;
  strikeRate: number;
}
export interface BowlingLine {
  playerId: string;
  legalBalls: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  economy: number;
}

export function computeBatting(balls: Ball[]): Record<string, BattingLine> {
  const map: Record<string, BattingLine> = {};
  const ensure = (id: string): BattingLine => {
    if (!map[id]) map[id] = { playerId: id, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, out: false, strikeRate: 0 };
    return map[id];
  };
  for (const b of balls) {
    if (!b.striker_id) continue;
    const s = ensure(b.striker_id);
    // Runs to striker: count run runs unless extra is wide/no_ball running extras only.
    if (b.extra_type === "wide") {
      // wide: no ball faced, no runs to batter
    } else if (b.extra_type === "bye" || b.extra_type === "leg_bye") {
      s.ballsFaced += 1; // ball faced, no runs to batter
    } else if (b.extra_type === "declared") {
      s.ballsFaced += 1; // 1D counts as a ball faced, no runs to batter
    } else if (b.extra_type === "no_ball") {
      s.runs += b.runs ?? 0; // batter gets bat runs off no ball, ball not counted
    } else {
      s.ballsFaced += 1;
      s.runs += b.runs ?? 0;
      if (b.runs === 4) s.fours += 1;
      if (b.runs === 6) s.sixes += 1;
    }
    if (b.is_wicket && b.out_player_id) {
      const o = ensure(b.out_player_id);
      o.out = true;
      o.dismissal = b.wicket_type ?? "out";
    }
  }
  for (const k of Object.keys(map)) {
    const v = map[k];
    v.strikeRate = v.ballsFaced ? (v.runs * 100) / v.ballsFaced : 0;
  }
  return map;
}

export function computeBowling(balls: Ball[]): Record<string, BowlingLine> {
  const map: Record<string, BowlingLine> = {};
  const ensure = (id: string): BowlingLine => {
    if (!map[id]) map[id] = { playerId: id, legalBalls: 0, runsConceded: 0, wickets: 0, maidens: 0, economy: 0 };
    return map[id];
  };
  // group overs to compute maidens
  const overGroups: Record<string, { runs: number; legal: number; bowlerId: string }> = {};
  for (const b of balls) {
    if (!b.bowler_id) continue;
    const bl = ensure(b.bowler_id);
    const key = `${b.bowler_id}|${b.innings_number}|${b.over_number}`;
    overGroups[key] ??= { runs: 0, legal: 0, bowlerId: b.bowler_id };
    if (b.is_legal_ball) bl.legalBalls += 1;
    // Concede runs: bat runs always + wide/no_ball penalties; byes/leg byes NOT charged to bowler
    const conceded =
      (b.extra_type === "bye" || b.extra_type === "leg_bye" || b.extra_type === "declared")
        ? 0
        : (b.runs ?? 0) + (b.extra_runs ?? 0);
    bl.runsConceded += conceded;
    overGroups[key].runs += conceded;
    if (b.is_legal_ball) overGroups[key].legal += 1;
    if (b.is_wicket && b.wicket_type && b.wicket_type !== "Run Out") bl.wickets += 1;
  }
  for (const k of Object.keys(overGroups)) {
    const g = overGroups[k];
    if (g.legal === 6 && g.runs === 0) {
      const line = map[g.bowlerId];
      if (line) line.maidens += 1;
    }
  }
  for (const k of Object.keys(map)) {
    const v = map[k];
    v.economy = v.legalBalls ? (v.runsConceded * 6) / v.legalBalls : 0;
  }
  return map;
}

export function computeFielding(balls: Ball[]): Record<string, { catches: number; runOuts: number }> {
  const map: Record<string, { catches: number; runOuts: number }> = {};
  const ensure = (id: string) => (map[id] ??= { catches: 0, runOuts: 0 });
  for (const b of balls) {
    if (!b.is_wicket || !b.fielder_id) continue;
    const f = ensure(b.fielder_id);
    if (b.wicket_type === "Caught" || b.wicket_type === "Stumped") f.catches += 1;
    if (b.wicket_type === "Run Out") f.runOuts += 1;
  }
  return map;
}

export interface OverEvent {
  over: number;
  balls: { label: string; runs: number; isWicket: boolean }[];
}

export function buildOverTimeline(balls: Ball[], innings: number): OverEvent[] {
  const out: OverEvent[] = [];
  for (const b of balls) {
    if (b.innings_number !== innings) continue;
    let ov = out.find((o) => o.over === b.over_number);
    if (!ov) {
      ov = { over: b.over_number, balls: [] };
      out.push(ov);
    }
    let label = String(b.runs ?? 0);
    if (b.extra_type === "wide") label = `Wd${b.extra_runs ? "+" + b.extra_runs : ""}`;
    else if (b.extra_type === "no_ball") label = `Nb${b.runs ? "+" + b.runs : ""}`;
    else if (b.extra_type === "bye") label = `B${b.extra_runs ?? 0}`;
    else if (b.extra_type === "leg_bye") label = `Lb${b.extra_runs ?? 0}`;
    else if (b.extra_type === "declared") label = `1D`;
    if (b.is_wicket) label = "W";
    if (b.runs === 4 && !b.extra_type) label = "4";
    if (b.runs === 6 && !b.extra_type) label = "6";
    ov.balls.push({ label, runs: (b.runs ?? 0) + (b.extra_runs ?? 0), isWicket: !!b.is_wicket });
  }
  return out.sort((a, b) => a.over - b.over);
}

export function playerMatchScore(b: BattingLine | undefined, bw: BowlingLine | undefined, c: number): number {
  // Heuristic player-of-the-match: runs + 20*wickets + 10*catches + small SR/economy boost
  const runs = b?.runs ?? 0;
  const wkts = bw?.wickets ?? 0;
  const sr = b?.strikeRate ?? 0;
  const eco = bw?.economy ?? 0;
  const ecoBoost = bw && bw.legalBalls >= 6 ? Math.max(0, (10 - eco) * 2) : 0;
  const srBoost = b && b.ballsFaced >= 6 ? Math.max(0, (sr - 100) / 10) : 0;
  return runs + wkts * 20 + c * 10 + ecoBoost + srBoost;
}

// ---------- Commentary ----------
export function commentaryFor(
  ball: {
    runs: number;
    extra_type: string | null;
    extra_runs: number;
    is_wicket: boolean;
    wicket_type?: string | null;
  },
  names: { striker?: string; bowler?: string; outPlayer?: string; fielder?: string },
): string {
  const s = names.striker ?? "Batter";
  const b = names.bowler ?? "Bowler";
  if (ball.is_wicket) {
    const who = names.outPlayer ?? s;
    const wt = ball.wicket_type ?? "OUT";
    if (wt === "Caught" && names.fielder) return `OUT! ${who} caught by ${names.fielder} off ${b}. What a moment!`;
    if (wt === "Run Out") return `RUN OUT! ${who} short of the crease${names.fielder ? `, ${names.fielder} with the throw` : ""}.`;
    if (wt === "Bowled") return `BOWLED! ${b} cleans up ${who}. Timber!`;
    if (wt === "LBW") return `LBW! ${b} traps ${who} plumb in front.`;
    if (wt === "Stumped" && names.fielder) return `STUMPED! ${names.fielder} whips off the bails — ${who} gone.`;
    return `WICKET! ${who} departs (${wt}) off ${b}.`;
  }
  if (ball.extra_type === "wide") {
    const total = (ball.extra_runs ?? 0) + (ball.runs ?? 0);
    return `Wide called against ${b}.${total > 0 ? ` ${total} extra${total > 1 ? "s" : ""}.` : " Extra ball, no run."}`;
  }
  if (ball.extra_type === "no_ball") return `No ball! Free hit territory. ${ball.runs ? `${s} pinches ${ball.runs} off the bat.` : "1 run added."}`;
  if (ball.extra_type === "bye") return `${ball.extra_runs} bye${ball.extra_runs > 1 ? "s" : ""} — keeper beaten by ${b}.`;
  if (ball.extra_type === "leg_bye") return `${ball.extra_runs} leg bye${ball.extra_runs > 1 ? "s" : ""} off the pads of ${s}.`;
  if (ball.extra_type === "declared") return `1D! Run declared — ${s} stays on strike, ball counted.`;
  const r = ball.runs ?? 0;
  if (r === 6) return `SIX! ${s} launches ${b} into the stands! Massive hit!`;
  if (r === 4) return `FOUR! ${s} times it sweetly off ${b} — to the fence!`;
  if (r === 3) return `Three runs, well run by ${s}.`;
  if (r === 2) return `Couple of runs picked up by ${s}.`;
  if (r === 1) return `Single taken, ${s} rotates strike.`;
  return `Dot ball. ${b} keeps ${s} honest.`;
}

// ---------- Partnerships ----------
export interface Partnership {
  innings: number;
  wicket: number; // 1st, 2nd, …
  runs: number;
  balls: number;
  player1: string;
  player2: string;
  unbeaten: boolean;
}

export function computePartnerships(balls: Ball[], innings: number): Partnership[] {
  const out: Partnership[] = [];
  let current: Partnership | null = null;
  let wicketNo = 0;
  for (const b of balls) {
    if (b.innings_number !== innings) continue;
    if (!b.striker_id || !b.non_striker_id) continue;
    if (!current || (current.player1 !== b.striker_id && current.player1 !== b.non_striker_id) ||
      (current.player2 !== b.striker_id && current.player2 !== b.non_striker_id)) {
      wicketNo += 1;
      current = {
        innings,
        wicket: wicketNo,
        runs: 0,
        balls: 0,
        player1: b.striker_id,
        player2: b.non_striker_id,
        unbeaten: true,
      };
      out.push(current);
    }
    const runs = (b.runs ?? 0) + (b.extra_runs ?? 0);
    current.runs += runs;
    if (b.is_legal_ball) current.balls += 1;
    if (b.is_wicket) current.unbeaten = false;
  }
  return out;
}

// ---------- Hat-tricks ----------
// A hat-trick = 3 wickets in 3 consecutive legal balls by the same bowler
// (bowled/caught/lbw/stumped/hit-wicket — run-outs excluded, same as bowling wickets).
export function computeHatTricks(balls: Ball[]): Record<string, { count: number; balls: number[] }> {
  const map: Record<string, { count: number; balls: number[] }> = {};
  const ensure = (id: string) => (map[id] ??= { count: 0, balls: [] });
  // group by bowler + innings, in order
  const byBowler: Record<string, Ball[]> = {};
  const ordered = [...balls].sort((a, b) => a.ball_index - b.ball_index);
  for (const b of ordered) {
    if (!b.bowler_id || !b.is_legal_ball) continue;
    const k = `${b.bowler_id}|${b.innings_number}`;
    (byBowler[k] ??= []).push(b);
  }
  const isBowlerWicket = (b: Ball) => b.is_wicket && b.wicket_type && b.wicket_type !== "Run Out";
  for (const k of Object.keys(byBowler)) {
    const arr = byBowler[k];
    for (let i = 0; i <= arr.length - 3; i++) {
      if (isBowlerWicket(arr[i]) && isBowlerWicket(arr[i + 1]) && isBowlerWicket(arr[i + 2])) {
        const bl = ensure(arr[i].bowler_id as string);
        bl.count += 1;
        bl.balls.push(arr[i + 2].ball_index);
        i += 2;
      }
    }
  }
  return map;
}