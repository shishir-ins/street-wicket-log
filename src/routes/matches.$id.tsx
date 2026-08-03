import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import {
  computeBatting, computeBowling, computeFielding,
  computeInningsTotals, buildOverTimeline, oversString, runRate, requiredRunRate, playerMatchScore,
  commentaryFor, computePartnerships, computeHatTricks,
  type Ball, type Player, type Match, type MatchState, type Team,
} from "@/lib/cricket";
import {
  ArrowLeft, Undo2, Redo2, Pause, Play, Award, Activity, Share2, FileDown, MessageSquare, Users, Repeat,
} from "lucide-react";
import { useAdmin, AdminLockButton } from "@/lib/admin";
import { PlayerChip } from "@/components/PlayerChip";
import { Celebration, type CelebrationKind } from "@/components/Celebration";

export const Route = createFileRoute("/matches/$id")({
  head: () => ({
    meta: [
      { title: "Live Match — BELLAMLABIDI" },
      { name: "description", content: "Ball-by-ball cricket scoring with full live scorecard." },
    ],
  }),
  component: MatchPage,
});

function MatchPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const matchQ = useQuery({
    queryKey: ["match", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Match;
    },
  });
  const ballsQ = useQuery({
    queryKey: ["balls", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("balls").select("*").eq("match_id", id).order("ball_index");
      if (error) throw error;
      return data as Ball[];
    },
  });
  const playersQ = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*").order("name");
      if (error) throw error;
      return data as Player[];
    },
  });

  // poll for live matches so other devices see updates
  useEffect(() => {
    const m = matchQ.data;
    if (!m || m.status === "completed") return;
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["match", id] });
      qc.invalidateQueries({ queryKey: ["balls", id] });
    }, 2000);
    return () => clearInterval(interval);
  }, [matchQ.data, id, qc]);

  if (matchQ.isLoading || playersQ.isLoading) return <AppShell><p className="font-chalk">Loading…</p></AppShell>;
  if (!matchQ.data) return <AppShell><p className="font-chalk">Match not found.</p></AppShell>;

  const match = matchQ.data;
  const balls = ballsQ.data ?? [];
  const players = playersQ.data ?? [];
  const byId: Record<string, Player> = Object.fromEntries(players.map((p) => [p.id, p]));

  if (match.status === "completed") {
    return <FinalScorecard match={match} balls={balls} byId={byId} />;
  }
  return <LiveScoring match={match} balls={balls} byId={byId} players={players} />;
}

// ---------- LIVE SCORING ----------

function LiveScoring({ match, balls, byId, players }: { match: Match; balls: Ball[]; byId: Record<string, Player>; players: Player[] }) {
  const qc = useQueryClient();
  const { isAdmin } = useAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = match.state as any as MatchState;
  // If a previous innings was declared with a cap, restrict this innings to the same number of legal balls.
  const totalBalls = state.innings === 2 && state.inningsBallsCap != null
    ? state.inningsBallsCap
    : match.total_overs * 6;
  const innings = state.innings;

  const inningsBalls = balls.filter((b) => b.innings_number === innings);
  const totals = computeInningsTotals(balls, innings);
  const lastOverBalls = inningsBalls.filter((b) => b.over_number === Math.floor(totals.legalBalls / 6) || (b.over_number === Math.floor(totals.legalBalls / 6) - 1 && totals.legalBalls % 6 === 0)).slice(-12);
  const ballsInCurrentOver = inningsBalls.filter((b) => b.is_legal_ball).slice(-((totals.legalBalls % 6) || 6));
  void ballsInCurrentOver;

  const battingPlayers = (state.battingTeam === "A" ? match.team_a_players : match.team_b_players) as unknown as string[];
  const bowlingPlayers = (state.bowlingTeam === "A" ? match.team_a_players : match.team_b_players) as unknown as string[];
  const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));
  const battingTeamWithCommon = uniq(match.common_player_id ? [...battingPlayers, match.common_player_id] : battingPlayers);
  const bowlingTeamWithCommon = uniq(match.common_player_id ? [...bowlingPlayers, match.common_player_id] : bowlingPlayers);
  const battingTeamName = state.battingTeam === "A" ? match.team_a_name : match.team_b_name;
  const bowlingTeamName = state.bowlingTeam === "A" ? match.team_a_name : match.team_b_name;
  const battingTeamSize = battingTeamWithCommon.length;

  const batting = computeBatting(balls);
  const bowling = computeBowling(balls);

  const striker = state.strikerId ? byId[state.strikerId] : undefined;
  const nonStriker = state.nonStrikerId ? byId[state.nonStrikerId] : undefined;
  const bowler = state.bowlerId ? byId[state.bowlerId] : undefined;

  const sBat = state.strikerId ? batting[state.strikerId] : undefined;
  const nBat = state.nonStrikerId ? batting[state.nonStrikerId] : undefined;
  const bBow = state.bowlerId ? bowling[state.bowlerId] : undefined;

  // Modifiers and dialogs
  const [extraMod, setExtraMod] = useState<"wide" | "no_ball" | "bye" | "leg_bye" | null>(null);
  const [wicketDialog, setWicketDialog] = useState(false);
  const [pendingNextBowler, setPendingNextBowler] = useState(false);
  const [pendingNewBatsman, setPendingNewBatsman] = useState<{ runs: number } | null>(null);
  const [inningsBreakDialog, setInningsBreakDialog] = useState(false);
  const [target, setTarget] = useState<number | null>(state.target ?? null);
  const [changeBowlerOpen, setChangeBowlerOpen] = useState(false);
  const [replaceBatsman, setReplaceBatsman] = useState<null | "striker" | "nonStriker">(null);
  // Local redo stack of undone balls (not persisted across reloads)
  const [redoStack, setRedoStack] = useState<Array<{ ball: Ball; stateAfter: MatchState; status: string }>>([]);

  // Celebration overlay for milestones (50/100/hat-trick/six)
  const [celebration, setCelebration] = useState<{ kind: CelebrationKind; name?: string }>({ kind: null });
  const milestoneRef = useRef<{ batting: Record<string, number>; hats: Record<string, number>; initialized: boolean }>({
    batting: {}, hats: {}, initialized: false,
  });
  useEffect(() => {
    const hats = computeHatTricks(balls);
    // On first render just baseline (don't celebrate historical events on load)
    if (!milestoneRef.current.initialized) {
      const bl: Record<string, number> = {};
      for (const k of Object.keys(batting)) bl[k] = batting[k].runs;
      const ht: Record<string, number> = {};
      for (const k of Object.keys(hats)) ht[k] = hats[k].count;
      milestoneRef.current = { batting: bl, hats: ht, initialized: true };
      return;
    }
    let fired: { kind: CelebrationKind; name?: string } | null = null;
    // Batting milestones — check striker & non-striker changes
    for (const pid of Object.keys(batting)) {
      const prev = milestoneRef.current.batting[pid] ?? 0;
      const curr = batting[pid].runs;
      milestoneRef.current.batting[pid] = curr;
      if (prev < 100 && curr >= 100) { fired = { kind: "hundred", name: byId[pid]?.name }; continue; }
      if (prev < 50 && curr >= 50 && !fired) fired = { kind: "fifty", name: byId[pid]?.name };
    }
    // Hat-trick — any bowler's count increased
    for (const pid of Object.keys(hats)) {
      const prev = milestoneRef.current.hats[pid] ?? 0;
      const curr = hats[pid].count;
      if (curr > prev) fired = { kind: "hattrick", name: byId[pid]?.name };
      milestoneRef.current.hats[pid] = curr;
    }
    if (fired) setCelebration(fired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balls]);

  // Detect target from completed innings 1
  useEffect(() => {
    if (innings === 2 && state.target == null) {
      const i1 = computeInningsTotals(balls, 1);
      if (i1.legalBalls > 0) setTarget(i1.runs + 1);
    } else {
      setTarget(state.target ?? null);
    }
  }, [innings, state.target, balls]);

  // Persist a new ball + update state
  const recordBall = useMutation({
    mutationFn: async (payload: {
      runs: number;
      extraType?: "wide" | "no_ball" | "bye" | "leg_bye" | "declared" | null;
      isWicket?: boolean;
      wicketType?: string;
      outPlayerId?: string;
      fielderId?: string;
    }) => {
      const isLegal = !(payload.extraType === "wide" || payload.extraType === "no_ball");

      // Custom BELLAMLABIDI wide rule:
      //   1st wide  -> 0 run + extra ball
      //   2nd+ consecutive wides -> 1 run each + extra ball
      let wideBaseRun = 0;
      if (payload.extraType === "wide") {
        let consecutive = 1; // including this one
        for (let i = inningsBalls.length - 1; i >= 0; i--) {
          if (inningsBalls[i].extra_type === "wide") consecutive += 1;
          else break;
        }
        wideBaseRun = consecutive === 1 ? 0 : 1;
      }

      const extraRuns =
        payload.extraType === "wide"
          ? wideBaseRun + payload.runs
          : payload.extraType === "no_ball"
            ? 1
            : payload.extraType === "bye" || payload.extraType === "leg_bye"
              ? payload.runs
              : payload.extraType === "declared"
                ? 1
                : 0;
      const batRuns =
        payload.extraType === "wide" || payload.extraType === "bye" || payload.extraType === "leg_bye" || payload.extraType === "declared"
          ? 0
          : payload.runs;

      const overNumber = Math.floor(totals.legalBalls / 6);
      const ballInOver = (totals.legalBalls % 6) + (isLegal ? 1 : 0);
      const ballIndex = (state.ballIndex ?? 0) + 1;

      const commentary = commentaryFor(
        {
          runs: batRuns,
          extra_type: payload.extraType ?? null,
          extra_runs: extraRuns,
          is_wicket: !!payload.isWicket,
          wicket_type: payload.wicketType ?? null,
        },
        {
          striker: state.strikerId ? byId[state.strikerId]?.name : undefined,
          bowler: state.bowlerId ? byId[state.bowlerId]?.name : undefined,
          outPlayer: payload.outPlayerId ? byId[payload.outPlayerId]?.name : undefined,
          fielder: payload.fielderId ? byId[payload.fielderId]?.name : undefined,
        },
      );

      // Insert ball
      const { error: berr } = await supabase.from("balls").insert({
        match_id: match.id,
        innings_number: innings,
        ball_index: ballIndex,
        over_number: overNumber,
        ball_in_over: ballInOver,
        bowler_id: state.bowlerId,
        striker_id: state.strikerId,
        non_striker_id: state.nonStrikerId,
        runs: batRuns,
        extra_type: payload.extraType ?? null,
        extra_runs: extraRuns,
        is_legal_ball: isLegal,
        is_wicket: !!payload.isWicket,
        wicket_type: payload.wicketType ?? null,
        out_player_id: payload.outPlayerId ?? null,
        fielder_id: payload.fielderId ?? null,
        batting_team: state.battingTeam,
        commentary,
      });
      if (berr) throw berr;

      // Compute new state (after this ball)
      const newLegalBalls = totals.legalBalls + (isLegal ? 1 : 0);
      const newWickets = totals.wickets + (payload.isWicket ? 1 : 0);
      const totalRunsThisBall = batRuns + extraRuns;

      // Last man standing: only one batsman left — he keeps strike no matter what.
      const lastManStanding = !state.nonStrikerId;

      // Strike swap on odd run counts (bat or bye/leg-bye); wide adds no strike-altering run except via extras taken
      let newStrikerId = state.strikerId;
      let newNonStrikerId = state.nonStrikerId;
      const runsForStrikeSwap = batRuns + (payload.extraType === "bye" || payload.extraType === "leg_bye" ? payload.runs : 0);
      if (!lastManStanding && runsForStrikeSwap % 2 === 1) {
        [newStrikerId, newNonStrikerId] = [newNonStrikerId, newStrikerId];
      }

      // End of over — swap strike + need new bowler
      const overEnded = isLegal && newLegalBalls % 6 === 0 && newLegalBalls > 0;
      if (overEnded && !lastManStanding) {
        [newStrikerId, newNonStrikerId] = [newNonStrikerId, newStrikerId];
      }

      // Wicket → need new batsman (unless innings ends)
      const outBatsmen = [...(state.outBatsmen ?? [])];
      if (payload.isWicket && payload.outPlayerId) outBatsmen.push(payload.outPlayerId);

      // Everyone bats: the innings ends only when every batter in the team is out.
      const battersRemaining = battingTeamSize - newWickets;
      const allOut = battersRemaining <= 0;
      const oversComplete = newLegalBalls >= totalBalls;
      const chasedDown = innings === 2 && target != null && (totals.runs + totalRunsThisBall) >= target;
      const inningsOver = allOut || oversComplete || chasedDown;

      // Build new state without striker swap if we need new batsman
      const nextState: MatchState = {
        ...state,
        ballIndex,
        outBatsmen,
        strikerId: newStrikerId,
        nonStrikerId: newNonStrikerId,
      };

      // If batter is out — they leave field; mark slot empty, dialog will set new batsman
      if (payload.isWicket && payload.outPlayerId) {
        if (payload.outPlayerId === state.strikerId) nextState.strikerId = null;
        else if (payload.outPlayerId === state.nonStrikerId) nextState.nonStrikerId = null;
        else {
          // running between wickets out — could be either; treat as striker out by default
          nextState.strikerId = null;
        }
        // Exactly one batter left → he bats alone and always keeps strike.
        if (battersRemaining === 1 && !allOut) {
          const survivor = nextState.strikerId ?? nextState.nonStrikerId ?? null;
          nextState.strikerId = survivor;
          nextState.nonStrikerId = null;
        }
      }

      // Persist
      let newStatus = match.status;
      if (inningsOver) {
        if (innings === 1) {
          nextState.target = totals.runs + totalRunsThisBall + 1;
          newStatus = "innings_break";
        } else {
          newStatus = "completed";
        }
      }

      const { error: merr } = await supabase.from("matches")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ state: nextState as any, status: newStatus })
        .eq("id", match.id);
      if (merr) throw merr;

      return {
        overEnded,
        inningsOver,
        needNewBatsman: !!payload.isWicket && !inningsOver && battersRemaining >= 2,
      };
    },
    onSuccess: async (r) => {
      setExtraMod(null);
      setRedoStack([]); // any new ball invalidates redo history
      await qc.invalidateQueries({ queryKey: ["match", match.id] });
      await qc.invalidateQueries({ queryKey: ["balls", match.id] });
      qc.invalidateQueries({ queryKey: ["balls", "all"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
      if (r?.inningsOver) {
        setInningsBreakDialog(true);
      } else {
        if (r?.needNewBatsman) setPendingNewBatsman({ runs: 0 });
        if (r?.overEnded) setPendingNextBowler(true);
      }
    },
  });

  const undoLast = useMutation({
    mutationFn: async () => {
      const last = [...balls].sort((a, b) => b.ball_index - a.ball_index)[0];
      if (!last) return;
      // capture snapshot for redo BEFORE deleting
      const snapshot = { ball: last, stateAfter: state, status: match.status };
      // Restore previous state
      const { error: derr } = await supabase.from("balls").delete().eq("id", last.id);
      if (derr) throw derr;
      // Re-derive striker/non-striker/bowler from previous state — best effort:
      // Easiest: set state to use last ball's striker/non-striker/bowler and previous innings if needed
      const prev: MatchState = {
        ...state,
        strikerId: last.striker_id,
        nonStrikerId: last.non_striker_id,
        bowlerId: last.bowler_id,
        ballIndex: Math.max(0, (state.ballIndex ?? 0) - 1),
        innings: last.innings_number as 1 | 2,
        battingTeam: last.batting_team as Team,
        bowlingTeam: (last.batting_team === "A" ? "B" : "A") as Team,
        outBatsmen: (state.outBatsmen ?? []).filter((x) => x !== last.out_player_id),
      };
      const { error: merr } = await supabase.from("matches")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ state: prev as any, status: "live" }).eq("id", match.id);
      if (merr) throw merr;
      return snapshot;
    },
    onSuccess: (snap) => {
      if (snap) setRedoStack((s) => [...s, snap]);
      qc.invalidateQueries({ queryKey: ["match", match.id] });
      qc.invalidateQueries({ queryKey: ["balls", match.id] });
    },
  });

  const redoLast = useMutation({
    mutationFn: async () => {
      const snap = redoStack[redoStack.length - 1];
      if (!snap) return null;
      // Re-insert exact ball row (without id/created_at which will be regenerated)
      const { id: _drop, created_at: _c, ...row } = snap.ball as unknown as Record<string, unknown>;
      void _drop; void _c;
      const { error: berr } = await supabase.from("balls").insert(row as never);
      if (berr) throw berr;
      const { error: merr } = await supabase.from("matches")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ state: snap.stateAfter as any, status: snap.status }).eq("id", match.id);
      if (merr) throw merr;
      return snap;
    },
    onSuccess: (snap) => {
      if (snap) setRedoStack((s) => s.slice(0, -1));
      qc.invalidateQueries({ queryKey: ["match", match.id] });
      qc.invalidateQueries({ queryKey: ["balls", match.id] });
    },
  });

  const setStateMut = useMutation({
    mutationFn: async (next: Partial<MatchState> & { status?: string }) => {
      const { status, ...rest } = next;
      const merged = { ...state, ...rest };
      const update: { state: unknown; status?: string } = { state: merged };
      if (status) update.status = status;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("matches").update(update as any).eq("id", match.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match", match.id] });
    },
  });

  // Add an existing squad player into one of the teams mid-match
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const addPlayerMid = useMutation({
    mutationFn: async (v: { playerId: string; team: Team }) => {
      if (!v.playerId) throw new Error("Pick a player from the squad");
      const col = v.team === "A" ? "team_a_players" : "team_b_players";
      const current = ((v.team === "A" ? match.team_a_players : match.team_b_players) as unknown as string[]) ?? [];
      if (current.includes(v.playerId)) throw new Error("Player is already in that team");
      const next = Array.from(new Set([...current, v.playerId]));
      const { error } = await supabase
        .from("matches")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ [col]: next } as any)
        .eq("id", match.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setAddPlayerOpen(false);
      addPlayerMid.reset();
      qc.invalidateQueries({ queryKey: ["match", match.id] });
    },
  });

  // Score click handler
  const onRun = (n: number) => {
    recordBall.mutate({ runs: n, extraType: extraMod ?? null });
  };

  const onOneDeclared = () => {
    // 1D: 1 team run, legal ball, no strike swap, no bat run
    recordBall.mutate({ runs: 0, extraType: "declared" });
  };

  const togglePause = () => {
    const next = match.status === "match_break" ? "live" : "match_break";
    setStateMut.mutate({ status: next });
  };

  // Declare / Forfeit current innings (innings 1 only -> sets cap & target for innings 2;
  // innings 2 -> ends the match)
  const declareInnings = useMutation({
    mutationFn: async () => {
      if (innings === 1) {
        const nextState: MatchState = {
          ...state,
          target: totals.runs + 1,
          inningsBallsCap: totals.legalBalls,
          declared: true,
        };
        const { error } = await supabase.from("matches")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ state: nextState as any, status: "innings_break" }).eq("id", match.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("matches")
          .update({ status: "completed" }).eq("id", match.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match", match.id] });
      if (innings === 1) setInningsBreakDialog(true);
    },
  });

  const onDeclare = () => {
    const msg = innings === 1
      ? `Declare ${battingTeamName} innings at ${totals.runs}/${totals.wickets}? Innings 2 will be capped to ${oversString(totals.legalBalls)} overs.`
      : `Forfeit ${battingTeamName} innings and end the match?`;
    if (window.confirm(msg)) declareInnings.mutate();
  };

  const overTimeline = useMemo(() => buildOverTimeline(balls, innings), [balls, innings]);
  const currentOver = overTimeline[overTimeline.length - 1];
  const prevOver = overTimeline[overTimeline.length - 2];

  const rr = runRate(totals.runs, totals.legalBalls);
  const rrr = innings === 2 && target ? requiredRunRate(target, totals.runs, totalBalls, totals.legalBalls) : null;
  const battingTeamSizeForUI = battingTeamSize;

  const isPaused = match.status === "match_break";
  const isInningsBreak = match.status === "innings_break";
  const availableBatsmen = battingTeamWithCommon.filter((pid) =>
    pid !== state.strikerId && pid !== state.nonStrikerId &&
    !(state.outBatsmen ?? []).includes(pid),
  );
  // Last man standing: nobody left to walk in — promote the survivor and never prompt.
  const lastManOnly = availableBatsmen.length === 0;
  const needsBatsman = (!state.strikerId || !state.nonStrikerId) && !lastManOnly;

  useEffect(() => {
    if (!isAdmin || isInningsBreak || !lastManOnly) return;
    if (!state.strikerId && state.nonStrikerId) {
      setStateMut.mutate({ strikerId: state.nonStrikerId, nonStrikerId: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isInningsBreak, lastManOnly, state.strikerId, state.nonStrikerId]);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <Link to="/matches" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Matches
        </Link>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-display tracking-widest text-destructive">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" /> {match.status.toUpperCase().replace("_"," ")}
          </span>
          {isAdmin && (
            <>
              <button onClick={togglePause} className="btn-chalk rounded-md px-3 py-1.5 text-xs inline-flex items-center gap-1">
                {isPaused ? <><Play className="h-3.5 w-3.5"/>Resume</> : <><Pause className="h-3.5 w-3.5"/>Break</>}
              </button>
              {!isInningsBreak && (
                <button onClick={onDeclare} disabled={declareInnings.isPending}
                  className="btn-chalk rounded-md px-3 py-1.5 text-xs inline-flex items-center gap-1 text-accent border-accent/40">
                  {innings === 1 ? "Declare" : "Forfeit"}
                </button>
              )}
            </>
          )}
          <AdminLockButton />
        </div>
      </div>
      {!isAdmin && (
        <div className="chalk-board p-3 mb-3 text-xs font-chalk text-muted-foreground text-center">
          👀 Viewer mode — live score updates every 2s. Only the admin can score.
        </div>
      )}

      {/* Score header */}
      <div className="chalk-board p-5 sm:p-7 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="font-display tracking-widest text-muted-foreground text-sm">{battingTeamName} — Innings {innings}</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="score-tile text-6xl sm:text-7xl text-primary">{totals.runs}</span>
              <span className="score-tile text-3xl text-muted-foreground">/{totals.wickets}</span>
            </div>
            <div className="font-chalk text-lg text-chalk-dim" style={{ color: "var(--chalk-dim)" }}>
              {oversString(totals.legalBalls)} / {match.total_overs} overs · CRR {rr.toFixed(2)}
              {rrr !== null && <> · RRR {rrr.toFixed(2)}</>}
            </div>
          </div>
          {target && innings === 2 && (
            <div className="text-right">
              <div className="text-xs font-display tracking-widest text-muted-foreground">TARGET</div>
              <div className="score-tile text-4xl text-accent">{target}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Need {Math.max(0, target - totals.runs)} off {Math.max(0, totalBalls - totals.legalBalls)} balls
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Batsmen + Bowler */}
      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <BatsmanCard label="Striker*" player={striker} line={sBat} />
        <BatsmanCard label="Non-striker" player={nonStriker} line={nBat} />
        <div className="chalk-board p-4">
          <div className="text-xs font-display tracking-wider text-muted-foreground">BOWLER</div>
          <div className="font-display text-2xl tracking-wide mt-0.5">{bowler?.name ?? "—"}</div>
          <div className="text-sm text-muted-foreground mt-1 font-chalk">
            {bBow ? `${Math.floor(bBow.legalBalls/6)}.${bBow.legalBalls%6}-${bBow.maidens}-${bBow.runsConceded}-${bBow.wickets} · Eco ${bBow.economy.toFixed(2)}` : "—"}
          </div>
        </div>
      </div>

      {/* Over timeline */}
      <div className="chalk-board p-4 mb-4">
        <div className="flex items-center gap-2 mb-2 text-xs font-display tracking-wider text-muted-foreground">
          <Activity className="h-3.5 w-3.5" /> THIS OVER
        </div>
        <div className="flex flex-wrap gap-2 min-h-[2.5rem]">
          {(currentOver?.balls ?? []).map((b, i) => <BallPill key={`c-${i}`} label={b.label} wicket={b.isWicket} />)}
          {(currentOver?.balls ?? []).length === 0 && <span className="font-chalk text-muted-foreground">No balls yet.</span>}
        </div>
        {prevOver && (
          <>
            <div className="text-xs text-muted-foreground mt-3 font-display tracking-wider">PREVIOUS OVER</div>
            <div className="flex flex-wrap gap-2 mt-1">
              {prevOver.balls.map((b, i) => <BallPill key={`p-${i}`} label={b.label} wicket={b.isWicket} dim />)}
            </div>
          </>
        )}
      </div>

      {/* Scoring grid */}
      {isAdmin && !isInningsBreak && !needsBatsman && !pendingNextBowler && (
        <div className="chalk-board p-4 mb-4">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[0,1,2,3,4,6].map((n) => (
              <button key={n} disabled={isPaused || recordBall.isPending} onClick={() => onRun(n)}
                className={`btn-chalk rounded-md py-5 text-2xl ${n===4 ? "bg-accent/20 text-accent" : ""} ${n===6 ? "bg-primary/20 text-primary" : ""}`}>
                {n}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
            {([
              ["wide","Wide"],["no_ball","No Ball"],["bye","Bye"],["leg_bye","Leg Bye"],
            ] as const).map(([key, label]) => (
              <button key={key} disabled={isPaused || recordBall.isPending}
                onClick={() => setExtraMod(extraMod === key ? null : key)}
                className={`btn-chalk rounded-md py-3 text-sm ${extraMod===key ? "bg-accent/30 text-accent border-accent/60" : ""}`}>
                {label}{extraMod === key ? " ✓" : ""}
              </button>
            ))}
            <button disabled={isPaused || recordBall.isPending} onClick={() => setWicketDialog(true)}
              className="btn-chalk rounded-md py-3 text-sm bg-destructive/20 text-destructive border-destructive/40">
              WICKET
            </button>
          </div>
          {extraMod && (
            <p className="text-xs text-muted-foreground mt-2 font-chalk">
              Next number will be recorded as <span className="text-accent">{extraMod.replace("_"," ")}</span> + runs taken (tap 0 for just an extra).
            </p>
          )}
          {/* 1D + mid-innings changes */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
            <button disabled={isPaused || recordBall.isPending} onClick={onOneDeclared}
              className="btn-chalk rounded-md py-3 text-sm bg-primary/20 text-primary border-primary/50 font-display tracking-wider">
              1D
            </button>
            <button disabled={isPaused} onClick={() => setChangeBowlerOpen(true)}
              className="btn-chalk rounded-md py-3 text-xs inline-flex items-center justify-center gap-1">
              <Repeat className="h-3.5 w-3.5" /> Change bowler
            </button>
            <button disabled={isPaused} onClick={() => setReplaceBatsman("striker")}
              className="btn-chalk rounded-md py-3 text-xs">Change striker</button>
            <button disabled={isPaused} onClick={() => setReplaceBatsman("nonStriker")}
              className="btn-chalk rounded-md py-3 text-xs">Change non-striker</button>
            <button onClick={() => setAddPlayerOpen(true)}
              className="btn-chalk rounded-md py-3 text-xs">+ Add player</button>
          </div>
          <div className="mt-2">
            <button
              onClick={() => {
                if (!state.strikerId || !state.nonStrikerId) return;
                setStateMut.mutate({ strikerId: state.nonStrikerId, nonStrikerId: state.strikerId });
              }}
              className="btn-chalk rounded-md px-3 py-2 text-xs">Swap strike</button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={() => undoLast.mutate()} disabled={undoLast.isPending || balls.length===0}
              className="btn-chalk rounded-md px-3 py-2 text-sm inline-flex items-center gap-1">
              <Undo2 className="h-3.5 w-3.5" /> Undo last ball
            </button>
            <button onClick={() => redoLast.mutate()} disabled={redoLast.isPending || redoStack.length===0}
              className="btn-chalk rounded-md px-3 py-2 text-sm inline-flex items-center gap-1">
              <Redo2 className="h-3.5 w-3.5" /> Redo{redoStack.length ? ` (${redoStack.length})` : ""}
            </button>
            <button onClick={() => setExtraMod(null)} disabled={!extraMod}
              className="btn-chalk rounded-md px-3 py-2 text-sm">Clear extra</button>
          </div>
          {recordBall.error ? <p className="text-destructive text-sm mt-2">{(recordBall.error as Error).message}</p> : null}
        </div>
      )}

      {/* In-innings dialogs */}
      {isAdmin && wicketDialog && (
        <WicketDialog
          onClose={() => setWicketDialog(false)}
          onSubmit={(d) => {
            setWicketDialog(false);
            recordBall.mutate({
              runs: d.runs,
              extraType: extraMod ?? null,
              isWicket: true,
              wicketType: d.type,
              outPlayerId: d.outPlayerId,
              fielderId: d.fielderId || undefined,
            });
          }}
          striker={striker} nonStriker={nonStriker}
          fielders={bowlingTeamWithCommon.map((id) => byId[id]).filter(Boolean) as Player[]}
        />
      )}

      {isAdmin && (pendingNewBatsman || needsBatsman) && !lastManOnly && !isInningsBreak && (
        <NewBatsmanDialog
          availableIds={availableBatsmen}
          byId={byId}
          onPick={(pid) => {
            const next: Partial<MatchState> = {};
            if (!state.strikerId) next.strikerId = pid;
            else if (!state.nonStrikerId) next.nonStrikerId = pid;
            setStateMut.mutate(next);
            setPendingNewBatsman(null);
          }}
        />
      )}

      {isAdmin && pendingNextBowler && (
        <NextBowlerDialog
          availableIds={bowlingTeamWithCommon.filter((pid) => pid !== state.bowlerId)}
          byId={byId}
          onPick={(pid) => { setStateMut.mutate({ bowlerId: pid }); setPendingNextBowler(false); }}
          onSame={() => setPendingNextBowler(false)}
        />
      )}

      {isAdmin && changeBowlerOpen && (
        <NextBowlerDialog
          availableIds={bowlingTeamWithCommon.filter((pid) => pid !== state.bowlerId)}
          byId={byId}
          onPick={(pid) => { setStateMut.mutate({ bowlerId: pid }); setChangeBowlerOpen(false); }}
          onSame={() => setChangeBowlerOpen(false)}
        />
      )}

      {isAdmin && replaceBatsman && (
        <NewBatsmanDialog
          availableIds={battingTeamWithCommon.filter((pid) =>
            pid !== state.strikerId && pid !== state.nonStrikerId,
          )}
          byId={byId}
          onPick={(pid) => {
            const next: Partial<MatchState> = {};
            if (replaceBatsman === "striker") next.strikerId = pid;
            else next.nonStrikerId = pid;
            setStateMut.mutate(next);
            setReplaceBatsman(null);
          }}
          onClose={() => setReplaceBatsman(null)}
        />
      )}

      {isAdmin && (isInningsBreak || inningsBreakDialog) && innings === 1 && (
        <InningsBreakDialog
          target={state.target ?? totals.runs + 1}
          nextBattingTeamName={bowlingTeamName}
          battingIds={bowlingTeamWithCommon}
          bowlingIds={battingTeamWithCommon}
          byId={byId}
          onStart={(picks) => {
            const newState: MatchState = {
              ...state,
              innings: 2,
              battingTeam: state.bowlingTeam,
              bowlingTeam: state.battingTeam,
              strikerId: picks.strikerId,
              nonStrikerId: picks.nonStrikerId,
              bowlerId: picks.bowlerId,
              outBatsmen: [],
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabase.from("matches").update({ state: newState as any, status: "live" }).eq("id", match.id).then(() => {
              setInningsBreakDialog(false);
              qc.invalidateQueries({ queryKey: ["match", match.id] });
            });
          }}
        />
      )}

      {/* Tabbed scorecards — includes 1st innings when viewing 2nd */}
      <InningsTabs match={match} balls={balls} byId={byId} currentInnings={innings} />

      <PartnershipsBlock balls={inningsBalls} innings={innings} byId={byId} />
      <CommentaryFeed balls={inningsBalls} />
      <ShareToolbar match={match} balls={balls} byId={byId} />

      <p className="text-xs text-muted-foreground mt-6">
        Team size: {battingTeamSizeForUI}. {isAdmin ? "Saves automatically with every ball." : "Read-only view."}
      </p>
      <Celebration kind={celebration.kind} name={celebration.name} onDone={() => setCelebration({ kind: null })} />
      {isAdmin && addPlayerOpen && (
        <AddPlayerMidDialog
          teamAName={match.team_a_name}
          teamBName={match.team_b_name}
          defaultTeam={state.battingTeam}
          players={players}
          teamAIds={(match.team_a_players as unknown as string[]) ?? []}
          teamBIds={(match.team_b_players as unknown as string[]) ?? []}
          pending={addPlayerMid.isPending}
          error={(addPlayerMid.error as Error | null)?.message ?? null}
          onClose={() => { setAddPlayerOpen(false); addPlayerMid.reset(); }}
          onSubmit={(v) => addPlayerMid.mutate(v)}
        />
      )}
    </AppShell>
  );
}

function AddPlayerMidDialog({
  teamAName, teamBName, defaultTeam, players, teamAIds, teamBIds, pending, error, onClose, onSubmit,
}: {
  teamAName: string; teamBName: string; defaultTeam: Team;
  players: Player[]; teamAIds: string[]; teamBIds: string[];
  pending: boolean; error: string | null;
  onClose: () => void; onSubmit: (v: { playerId: string; team: Team }) => void;
}) {
  const [team, setTeam] = useState<Team>(defaultTeam);
  const [playerId, setPlayerId] = useState("");
  const inMatch = new Set([...teamAIds, ...teamBIds]);
  const available = players.filter((p) => !inMatch.has(p.id));
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card rounded-3xl p-5 w-full max-w-sm">
        <h3 className="font-display tracking-widest text-lg mb-1">Add player from squad</h3>
        <p className="text-xs text-muted-foreground font-chalk mb-3">Only players already in the squad can join mid-match.</p>
        <select
          className="w-full bg-input/40 border border-border rounded-md px-3 py-2 mb-2 text-foreground"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
        >
          <option value="">— select a squad player —</option>
          {available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {available.length === 0 ? (
          <p className="text-xs text-muted-foreground font-chalk mb-2">Everyone in the squad is already playing.</p>
        ) : null}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {(["A", "B"] as Team[]).map((t) => (
            <button key={t} onClick={() => setTeam(t)}
              className={`btn-chalk rounded-md py-2 text-xs ${team === t ? "bg-primary/25 text-primary border-primary/60" : ""}`}>
              {t === "A" ? teamAName : teamBName}
            </button>
          ))}
        </div>
        {error ? <p className="text-destructive text-sm mb-2">{error}</p> : null}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-chalk rounded-md px-3 py-2 text-sm flex-1">Cancel</button>
          <button
            disabled={pending || !playerId}
            onClick={() => onSubmit({ playerId, team })}
            className="btn-chalk rounded-md px-3 py-2 text-sm flex-1 bg-primary/20 text-primary"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BatsmanCard({ label, player, line }: { label: string; player?: Player; line?: { runs: number; ballsFaced: number; fours: number; sixes: number; strikeRate: number } }) {
  return (
    <div className="glass-card p-4 rounded-2xl">
      <div className="text-xs font-display tracking-wider text-muted-foreground">{label.toUpperCase()}</div>
      <div className="mt-1"><PlayerChip player={player} size="md" /></div>
      <div className="text-sm text-muted-foreground mt-1 font-chalk">
        {line ? `${line.runs} (${line.ballsFaced})  ·  SR ${line.strikeRate.toFixed(1)}  ·  ${line.fours}×4 ${line.sixes}×6` : "0 (0)"}
      </div>
    </div>
  );
}

function BallPill({ label, wicket, dim }: { label: string; wicket?: boolean; dim?: boolean }) {
  const color = wicket ? "bg-destructive/30 text-destructive border-destructive/40"
    : label === "4" ? "bg-accent/30 text-accent border-accent/50"
    : label === "6" ? "bg-primary/30 text-primary border-primary/50"
    : "bg-secondary text-foreground border-border";
  return <span className={`px-2.5 py-1 rounded-md border text-sm font-display tracking-wide ${color} ${dim ? "opacity-60" : ""}`}>{label}</span>;
}

// ---------- INNINGS TABS (crex-style batting/bowling) ----------
function InningsTabs({ match, balls, byId, currentInnings }: { match: Match; balls: Ball[]; byId: Record<string, Player>; currentInnings?: number }) {
  const teamA_ids = (match.team_a_players as unknown as string[]) ?? [];
  const teamB_ids = (match.team_b_players as unknown as string[]) ?? [];
  const withCommon = (ids: string[]) => Array.from(new Set(
    (match.common_player_id ? [...ids, match.common_player_id] : ids).filter(Boolean)
  ));
  const battingFirst = match.batting_first as Team;
  const t1Ids = withCommon(battingFirst === "A" ? teamA_ids : teamB_ids);
  const t2Ids = withCommon(battingFirst === "A" ? teamB_ids : teamA_ids);
  const t1Name = battingFirst === "A" ? match.team_a_name : match.team_b_name;
  const t2Name = battingFirst === "A" ? match.team_b_name : match.team_a_name;
  const i1Balls = balls.filter((b) => b.innings_number === 1);
  const i2Balls = balls.filter((b) => b.innings_number === 2);
  const hasI2 = i2Balls.length > 0 || currentInnings === 2;

  const tabs: { key: string; label: string; el: React.ReactNode }[] = [];
  tabs.push({ key: "i1-bat", label: `${t1Name} Bat`, el: <ScorecardBlock title={`${t1Name} batting — Innings 1`} ids={t1Ids} byId={byId} balls={i1Balls} mode="bat" /> });
  tabs.push({ key: "i1-bowl", label: `${t2Name} Bowl`, el: <ScorecardBlock title={`${t2Name} bowling — Innings 1`} ids={t2Ids} byId={byId} balls={i1Balls} mode="bowl" /> });
  if (hasI2) {
    tabs.push({ key: "i2-bat", label: `${t2Name} Bat`, el: <ScorecardBlock title={`${t2Name} batting — Innings 2`} ids={t2Ids} byId={byId} balls={i2Balls} mode="bat" /> });
    tabs.push({ key: "i2-bowl", label: `${t1Name} Bowl`, el: <ScorecardBlock title={`${t1Name} bowling — Innings 2`} ids={t1Ids} byId={byId} balls={i2Balls} mode="bowl" /> });
  }
  // Default to current innings batting when live
  const defaultKey = currentInnings === 2 ? "i2-bat" : "i1-bat";
  const [active, setActive] = useState<string>(defaultKey);
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-1.5 mb-2 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActive(t.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-display tracking-wider border whitespace-nowrap ${active === t.key ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground border-border hover:bg-secondary/70"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {activeTab?.el}
    </div>
  );
}

function ScorecardBlock({ title, ids, byId, balls, mode }: { title: string; ids: string[]; byId: Record<string, Player>; balls: Ball[]; mode: "bat" | "bowl" }) {
  const bat = computeBatting(balls);
  const bow = computeBowling(balls);
  const hats = computeHatTricks(balls);
  return (
    <div className="glass-card p-4 mt-4 rounded-2xl sticker-bat">
      <h3 className="font-display tracking-widest mb-3">{title}</h3>
      {mode === "bat" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground font-display tracking-wider">
              <tr><th className="text-left py-1">Player</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th><th className="text-right">Status</th></tr>
            </thead>
            <tbody>
              {ids.map((id) => {
                const l = bat[id];
                if (!l) return null;
                return (
                  <tr key={id} className="border-t border-border/30">
                    <td className="py-1.5"><PlayerChip player={byId[id]} size="xs" /></td>
                    <td className="text-center font-medium">{l.runs}</td>
                    <td className="text-center text-muted-foreground">{l.ballsFaced}</td>
                    <td className="text-center text-muted-foreground">{l.fours}</td>
                    <td className="text-center text-muted-foreground">{l.sixes}</td>
                    <td className="text-center text-muted-foreground">{l.strikeRate.toFixed(1)}</td>
                    <td className="text-right text-xs text-muted-foreground">{l.out ? l.dismissal : "not out"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground font-display tracking-wider">
              <tr><th className="text-left py-1">Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Eco</th><th title="Hat-tricks">H</th></tr>
            </thead>
            <tbody>
              {ids.map((id) => {
                const l = bow[id];
                if (!l) return null;
                const ht = hats[id]?.count ?? 0;
                return (
                  <tr key={id} className="border-t border-border/30">
                    <td className="py-1.5"><PlayerChip player={byId[id]} size="xs" /></td>
                    <td className="text-center">{Math.floor(l.legalBalls/6)}.{l.legalBalls%6}</td>
                    <td className="text-center">{l.maidens}</td>
                    <td className="text-center">{l.runsConceded}</td>
                    <td className="text-center font-medium">{l.wickets}</td>
                    <td className="text-center text-muted-foreground">{l.economy.toFixed(2)}</td>
                    <td className="text-center">{ht > 0 ? <span title="Hat-trick!" className="joker-shine px-1.5 py-0.5 rounded text-[10px] font-display tracking-wider">×{ht}</span> : <span className="text-muted-foreground">·</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- DIALOGS ----------

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose?: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="chalk-board p-5 max-w-md w-full animate-chalk-in" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display tracking-widest text-xl mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function WicketDialog({
  onClose, onSubmit, striker, nonStriker, fielders,
}: {
  onClose: () => void;
  onSubmit: (d: { type: string; outPlayerId: string; fielderId: string; runs: number }) => void;
  striker?: Player; nonStriker?: Player; fielders: Player[];
}) {
  const types = ["Bowled","Caught","LBW","Run Out","Stumped","Hit Wicket"];
  const [type, setType] = useState("Bowled");
  const [outId, setOutId] = useState(striker?.id ?? "");
  const [fielderId, setFielderId] = useState("");
  const [runs, setRuns] = useState(0);
  const needsFielder = type === "Caught" || type === "Stumped" || type === "Run Out";
  return (
    <Modal title="Wicket!" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground font-display tracking-wider">DISMISSAL</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {types.map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`btn-chalk rounded-md py-2 text-xs ${type===t ? "bg-destructive/30 text-destructive border-destructive/50" : ""}`}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-display tracking-wider">WHO IS OUT</label>
          <select className="w-full mt-1 bg-input/40 border border-border rounded-md px-3 py-2" value={outId} onChange={(e) => setOutId(e.target.value)}>
            {striker && <option value={striker.id}>{striker.name} (striker)</option>}
            {nonStriker && <option value={nonStriker.id}>{nonStriker.name} (non-striker)</option>}
          </select>
        </div>
        {needsFielder && (
          <div>
            <label className="text-xs text-muted-foreground font-display tracking-wider">FIELDER</label>
            <select className="w-full mt-1 bg-input/40 border border-border rounded-md px-3 py-2" value={fielderId} onChange={(e) => setFielderId(e.target.value)}>
              <option value="">— pick fielder —</option>
              {fielders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}
        {type === "Run Out" && (
          <div>
            <label className="text-xs text-muted-foreground font-display tracking-wider">RUNS COMPLETED</label>
            <input type="number" min={0} max={6} className="w-full mt-1 bg-input/40 border border-border rounded-md px-3 py-2" value={runs} onChange={(e) => setRuns(+e.target.value || 0)} />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-chalk rounded-md px-4 py-2">Cancel</button>
          <button
            onClick={() => onSubmit({ type, outPlayerId: outId, fielderId, runs })}
            disabled={!outId || (needsFielder && !fielderId)}
            className="rounded-md bg-destructive text-destructive-foreground px-4 py-2 font-display tracking-wide disabled:opacity-50">
            Record wicket
          </button>
        </div>
      </div>
    </Modal>
  );
}

function NewBatsmanDialog({ availableIds, byId, onPick, onClose }: { availableIds: string[]; byId: Record<string, Player>; onPick: (id: string) => void; onClose?: () => void }) {
  return (
    <Modal title="Next batsman" onClose={onClose}>
      {availableIds.length === 0 ? (
        <p className="font-chalk">No more batsmen available — innings will end.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {availableIds.map((id) => (
            <button key={id} onClick={() => onPick(id)} className="btn-chalk rounded-md py-3 text-sm">
              {byId[id]?.name ?? "?"}
            </button>
          ))}
        </div>
      )}
      {onClose && <button onClick={onClose} className="text-xs text-muted-foreground mt-3 hover:text-foreground">Cancel</button>}
    </Modal>
  );
}

function NextBowlerDialog({ availableIds, byId, onPick, onSame }: { availableIds: string[]; byId: Record<string, Player>; onPick: (id: string) => void; onSame: () => void }) {
  return (
    <Modal title="Next bowler">
      <div className="grid grid-cols-2 gap-2">
        {availableIds.map((id) => (
          <button key={id} onClick={() => onPick(id)} className="btn-chalk rounded-md py-3 text-sm">
            {byId[id]?.name ?? "?"}
          </button>
        ))}
      </div>
      <button onClick={onSame} className="text-xs text-muted-foreground mt-3 hover:text-foreground">Keep current bowler</button>
    </Modal>
  );
}

function InningsBreakDialog({
  target, nextBattingTeamName, battingIds, bowlingIds, byId, onStart,
}: {
  target: number; nextBattingTeamName: string; battingIds: string[]; bowlingIds: string[]; byId: Record<string, Player>;
  onStart: (picks: { strikerId: string; nonStrikerId: string; bowlerId: string }) => void;
}) {
  const [strikerId, setStrikerId] = useState("");
  const [nonStrikerId, setNonStrikerId] = useState("");
  const [bowlerId, setBowlerId] = useState("");
  return (
    <Modal title={`Innings break — ${nextBattingTeamName} needs ${target}`}>
      <div className="space-y-3">
        <PlayerPick label="Striker" value={strikerId} onChange={setStrikerId} ids={battingIds.filter((x) => x !== nonStrikerId)} byId={byId} />
        <PlayerPick label="Non-striker" value={nonStrikerId} onChange={setNonStrikerId} ids={battingIds.filter((x) => x !== strikerId)} byId={byId} />
        <PlayerPick label="Opening bowler" value={bowlerId} onChange={setBowlerId} ids={bowlingIds} byId={byId} />
        <div className="flex justify-end">
          <button disabled={!strikerId || !nonStrikerId || !bowlerId}
            onClick={() => onStart({ strikerId, nonStrikerId, bowlerId })}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 font-display tracking-wide disabled:opacity-50">
            Start innings 2 ▶
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PlayerPick({ label, value, onChange, ids, byId }: { label: string; value: string; onChange: (v: string) => void; ids: string[]; byId: Record<string, Player> }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground font-display tracking-wider">{label.toUpperCase()}</label>
      <select className="w-full mt-1 bg-input/40 border border-border rounded-md px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— select —</option>
        {ids.map((id) => <option key={id} value={id}>{byId[id]?.name ?? "?"}</option>)}
      </select>
    </div>
  );
}

// ---------- FINAL SCORECARD ----------

function FinalScorecard({ match, balls, byId }: { match: Match; balls: Ball[]; byId: Record<string, Player> }) {
  const i1 = computeInningsTotals(balls, 1);
  const i2 = computeInningsTotals(balls, 2);

  const teamA_ids = (match.team_a_players as unknown as string[]) ?? [];
  const teamB_ids = (match.team_b_players as unknown as string[]) ?? [];
  const allWithCommon = (ids: string[]) => Array.from(new Set(
    (match.common_player_id ? [...ids, match.common_player_id] : ids).filter(Boolean)
  ));

  const battingFirstTeam = match.batting_first as Team;
  const team1Ids = allWithCommon(battingFirstTeam === "A" ? teamA_ids : teamB_ids);
  const team2Ids = allWithCommon(battingFirstTeam === "A" ? teamB_ids : teamA_ids);
  const team1Name = battingFirstTeam === "A" ? match.team_a_name : match.team_b_name;
  const team2Name = battingFirstTeam === "A" ? match.team_b_name : match.team_a_name;

  // Compute result
  let resultText = "Match drawn";
  if (i1.runs > i2.runs) {
    resultText = `${team1Name} won by ${i1.runs - i2.runs} runs`;
  } else if (i2.runs > i1.runs) {
    const wktsLeft = (team2Ids.length - 1) - i2.wickets;
    resultText = `${team2Name} won by ${wktsLeft} wickets`;
  } else if (i1.runs > 0 || i2.runs > 0) {
    resultText = "Match tied";
  }

  // POM
  const batting = computeBatting(balls);
  const bowling = computeBowling(balls);
  const fielding = computeFielding(balls);
  const allIds = Array.from(new Set([...team1Ids, ...team2Ids]));
  const pom = allIds
    .map((id) => ({ id, score: playerMatchScore(batting[id], bowling[id], fielding[id]?.catches ?? 0) }))
    .sort((a, b) => b.score - a.score)[0];

  return (
    <AppShell>
      <Link to="/matches" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Matches
      </Link>
      <div className="chalk-board p-6 mb-4">
        <span className="tape-tag text-xs">FULL TIME</span>
        <h1 className="text-3xl sm:text-4xl font-display tracking-widest mt-3">{match.team_a_name} <span className="text-muted-foreground">vs</span> {match.team_b_name}</h1>
        <p className="font-chalk text-xl text-accent mt-2">{resultText}</p>
        <p className="text-xs text-muted-foreground mt-1">{new Date(match.match_date).toLocaleString()} · {match.total_overs} overs/side</p>
      </div>

      {pom && pom.score > 0 && (
        <div className="chalk-board p-5 mb-4 flex items-center gap-4">
          <Award className="h-10 w-10 text-accent shrink-0" />
          <div>
            <div className="text-xs font-display tracking-widest text-muted-foreground">PLAYER OF THE MATCH</div>
            <Link to="/players/$id" params={{ id: pom.id }} className="text-2xl font-display tracking-wide hover:text-primary">
              {byId[pom.id]?.name ?? "—"}
            </Link>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <InningsCard label={`${team1Name} — Innings 1`} totals={i1} overs={match.total_overs} />
        <InningsCard label={`${team2Name} — Innings 2`} totals={i2} overs={match.total_overs} />
      </div>

      <ScorecardBlock title={`${team1Name} batting`} ids={team1Ids} byId={byId} balls={balls.filter((b) => b.innings_number === 1)} mode="bat" />
      <ScorecardBlock title={`${team2Name} bowling`} ids={team2Ids} byId={byId} balls={balls.filter((b) => b.innings_number === 1)} mode="bowl" />
      <ScorecardBlock title={`${team2Name} batting`} ids={team2Ids} byId={byId} balls={balls.filter((b) => b.innings_number === 2)} mode="bat" />
      <ScorecardBlock title={`${team1Name} bowling`} ids={team1Ids} byId={byId} balls={balls.filter((b) => b.innings_number === 2)} mode="bowl" />

      <PartnershipsBlock balls={balls.filter((b) => b.innings_number === 1)} innings={1} byId={byId} />
      <PartnershipsBlock balls={balls.filter((b) => b.innings_number === 2)} innings={2} byId={byId} />
      <RunWheel balls={balls.filter((b) => b.innings_number === 1)} title={`${team1Name} run wheel`} />
      <RunWheel balls={balls.filter((b) => b.innings_number === 2)} title={`${team2Name} run wheel`} />
      <CommentaryFeed balls={balls} />
      <ShareToolbar match={match} balls={balls} byId={byId} />
    </AppShell>
  );
}

function InningsCard({ label, totals, overs }: { label: string; totals: ReturnType<typeof computeInningsTotals>; overs: number }) {
  return (
    <div className="chalk-board p-4">
      <div className="text-xs font-display tracking-wider text-muted-foreground">{label.toUpperCase()}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="score-tile text-4xl text-primary">{totals.runs}</span>
        <span className="score-tile text-xl text-muted-foreground">/{totals.wickets}</span>
      </div>
      <div className="text-xs text-muted-foreground mt-1">{oversString(totals.legalBalls)} / {overs} overs · {totals.fours}×4 {totals.sixes}×6 · Extras {totals.extras}</div>
    </div>
  );
}

// ---------- PARTNERSHIPS ----------
function PartnershipsBlock({ balls, innings, byId }: { balls: Ball[]; innings: number; byId: Record<string, Player> }) {
  const parts = computePartnerships(balls, innings);
  if (parts.length === 0) return null;
  const maxRuns = Math.max(...parts.map((p) => p.runs), 1);
  return (
    <div className="chalk-board p-4 mt-4">
      <h3 className="font-display tracking-widest mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Partnerships — Innings {innings}</h3>
      <ul className="space-y-2">
        {parts.map((p) => (
          <li key={`${p.innings}-${p.wicket}`} className="text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate"><span className="text-muted-foreground mr-1">{p.wicket}.</span>{byId[p.player1]?.name ?? "?"} & {byId[p.player2]?.name ?? "?"}</span>
              <span className="font-display tracking-wide">{p.runs}<span className="text-xs text-muted-foreground"> ({p.balls}){p.unbeaten ? "*" : ""}</span></span>
            </div>
            <div className="h-1.5 mt-1 rounded bg-secondary overflow-hidden">
              <div className="h-full bg-primary/70" style={{ width: `${(p.runs / maxRuns) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- COMMENTARY FEED ----------
function CommentaryFeed({ balls }: { balls: Ball[] }) {
  const ordered = [...balls].sort((a, b) => b.ball_index - a.ball_index).slice(0, 30);
  if (ordered.length === 0) return null;
  return (
    <div className="chalk-board p-4 mt-4">
      <h3 className="font-display tracking-widest mb-3 flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" />Commentary</h3>
      <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
        {ordered.map((b) => (
          <li key={b.id} className="text-sm border-b border-border/30 pb-2 last:border-0">
            <span className="font-display text-xs text-muted-foreground mr-2">{b.over_number}.{b.ball_in_over}</span>
            {b.commentary ?? `${b.runs} run${b.runs === 1 ? "" : "s"}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- RUN WHEEL (run distribution donut) ----------
function RunWheel({ balls, title }: { balls: Ball[]; title: string }) {
  const buckets = { dots: 0, ones: 0, twos: 0, threes: 0, fours: 0, sixes: 0, extras: 0 };
  for (const b of balls) {
    if (b.extra_type) { buckets.extras += (b.extra_runs ?? 0) + (b.runs ?? 0); continue; }
    const r = b.runs ?? 0;
    if (r === 0) buckets.dots += 1;
    else if (r === 1) buckets.ones += 1;
    else if (r === 2) buckets.twos += 2;
    else if (r === 3) buckets.threes += 3;
    else if (r === 4) buckets.fours += 4;
    else if (r >= 6) buckets.sixes += 6;
  }
  const total = buckets.ones + buckets.twos + buckets.threes + buckets.fours + buckets.sixes + buckets.extras;
  if (total === 0) return null;
  const segs: { label: string; value: number; color: string }[] = [
    { label: "1s", value: buckets.ones, color: "hsl(var(--muted-foreground))" },
    { label: "2s", value: buckets.twos, color: "hsl(var(--accent))" },
    { label: "3s", value: buckets.threes, color: "hsl(var(--secondary-foreground))" },
    { label: "4s", value: buckets.fours, color: "hsl(var(--primary))" },
    { label: "6s", value: buckets.sixes, color: "hsl(var(--destructive))" },
    { label: "Ext", value: buckets.extras, color: "hsl(var(--ring))" },
  ];
  const R = 70, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="chalk-board p-4 mt-4">
      <h3 className="font-display tracking-widest mb-3">{title}</h3>
      <div className="flex flex-wrap items-center gap-6">
        <svg width="180" height="180" viewBox="0 0 180 180">
          <g transform="translate(90 90) rotate(-90)">
            <circle r={R} fill="none" stroke="hsl(var(--border))" strokeWidth="22" />
            {segs.map((s) => {
              const len = (s.value / total) * C;
              const el = (
                <circle key={s.label} r={R} fill="none" stroke={s.color} strokeWidth="22"
                  strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
              );
              offset += len;
              return el;
            })}
          </g>
          <text x="90" y="95" textAnchor="middle" className="font-display fill-foreground" style={{ fontSize: 22 }}>{total}</text>
        </svg>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm font-chalk">
          {segs.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="ml-auto">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------- SHARE / PDF ----------
function buildScorecardText(match: Match, balls: Ball[], byId: Record<string, Player>): string {
  const i1 = computeInningsTotals(balls, 1);
  const i2 = computeInningsTotals(balls, 2);
  const lines: string[] = [];
  lines.push(`🏏 ${match.team_a_name} vs ${match.team_b_name}`);
  lines.push(`${new Date(match.match_date).toLocaleString()} · ${match.total_overs} overs/side`);
  lines.push("");
  const team1 = match.batting_first === "A" ? match.team_a_name : match.team_b_name;
  const team2 = match.batting_first === "A" ? match.team_b_name : match.team_a_name;
  lines.push(`${team1}: ${i1.runs}/${i1.wickets} (${oversString(i1.legalBalls)})`);
  if (i2.legalBalls > 0) lines.push(`${team2}: ${i2.runs}/${i2.wickets} (${oversString(i2.legalBalls)})`);
  lines.push("");
  const bat = computeBatting(balls);
  const top = Object.values(bat).sort((a, b) => b.runs - a.runs).slice(0, 3);
  if (top.length) {
    lines.push("Top scorers:");
    for (const t of top) lines.push(`  • ${byId[t.playerId]?.name ?? "?"} ${t.runs}(${t.ballsFaced})`);
  }
  const bow = computeBowling(balls);
  const wkt = Object.values(bow).sort((a, b) => b.wickets - a.wickets).slice(0, 3).filter((b) => b.wickets > 0);
  if (wkt.length) {
    lines.push("Top wickets:");
    for (const w of wkt) lines.push(`  • ${byId[w.playerId]?.name ?? "?"} ${w.wickets}/${w.runsConceded}`);
  }
  lines.push("");
  lines.push("— Scored on BELLAMLABIDI");
  return lines.join("\n");
}

function ShareToolbar({ match, balls, byId }: { match: Match; balls: Ball[]; byId: Record<string, Player> }) {
  const [busy, setBusy] = useState<"pdf" | "share" | null>(null);
  const text = buildScorecardText(match, balls, byId);

  const onShare = async () => {
    setBusy("share");
    try {
      const navAny = navigator as unknown as { share?: (d: { title: string; text: string }) => Promise<void> };
      if (navAny.share) {
        await navAny.share({ title: `${match.team_a_name} vs ${match.team_b_name}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        alert("Scorecard copied to clipboard!");
      }
    } catch (e) { /* user cancelled */ void e; }
    setBusy(null);
  };

  const onPdf = async () => {
    setBusy("pdf");
    try {
      const jsPDFmod = await import("jspdf");
      const doc = new jsPDFmod.jsPDF({ unit: "pt", format: "a4" });
      doc.setFont("helvetica", "bold"); doc.setFontSize(20);
      doc.text("BELLAMLABIDI", 40, 50);
      doc.setFontSize(14); doc.setFont("helvetica", "normal");
      doc.text(`${match.team_a_name} vs ${match.team_b_name}`, 40, 75);
      doc.setFontSize(10); doc.setTextColor(120);
      doc.text(`${new Date(match.match_date).toLocaleString()} · ${match.total_overs} overs/side`, 40, 92);
      doc.setTextColor(20);
      const body = text.split("\n");
      let y = 120;
      for (const ln of body) { doc.text(ln, 40, y); y += 16; if (y > 780) { doc.addPage(); y = 60; } }
      doc.save(`${match.team_a_name}-vs-${match.team_b_name}.pdf`);
    } catch (e) { alert("Could not build PDF: " + (e as Error).message); }
    setBusy(null);
  };

  return (
    <div className="chalk-board p-4 mt-4 flex flex-wrap gap-2">
      <button onClick={onShare} disabled={busy !== null} className="btn-chalk rounded-md px-4 py-2 bg-primary/20 text-primary inline-flex items-center gap-2 disabled:opacity-50">
        <Share2 className="h-4 w-4" /> {busy === "share" ? "Sharing…" : "Share scorecard"}
      </button>
      <button onClick={onPdf} disabled={busy !== null} className="btn-chalk rounded-md px-4 py-2 bg-secondary inline-flex items-center gap-2 disabled:opacity-50">
        <FileDown className="h-4 w-4" /> {busy === "pdf" ? "Building…" : "Download PDF"}
      </button>
    </div>
  );
}