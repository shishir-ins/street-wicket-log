import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildOverTimeline,
  computeBatting,
  computeBowling,
  computeInningsTotals,
  oversString,
  runRate,
  type Ball,
  type Match,
  type MatchState,
  type Player,
} from "@/lib/cricket";
import { PinLiveButton } from "@/components/PinLive";

/**
 * Crex / Google style live score card. Team + score, striker & non-striker
 * with their knocks, current bowler figures and the running over strip.
 */
export function LiveScoreCard({ match }: { match: Match }) {
  const ballsQ = useQuery({
    queryKey: ["live-card-balls", match.id],
    refetchInterval: 2000,
    queryFn: async () => {
      const { data, error } = await supabase.from("balls").select("*").eq("match_id", match.id).order("created_at");
      if (error) throw error;
      return (data ?? []) as Ball[];
    },
  });
  const playersQ = useQuery({
    queryKey: ["players-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*");
      if (error) throw error;
      return (data ?? []) as Player[];
    },
  });

  const balls = ballsQ.data ?? [];
  const players = playersQ.data ?? [];
  const byId = (id?: string | null) => players.find((p) => p.id === id);

  const state = (match.state as unknown as MatchState) ?? null;
  const innings = state?.innings ?? 1;
  const battingSide = state?.battingTeam ?? (match.batting_first as "A" | "B");
  const battingTeam = battingSide === "A" ? match.team_a_name : match.team_b_name;
  const bowlingTeam = battingSide === "A" ? match.team_b_name : match.team_a_name;

  const inningsBalls = balls.filter((b) => b.innings_number === innings);
  const totals = computeInningsTotals(balls, innings);
  const batting = computeBatting(inningsBalls);
  const bowling = computeBowling(inningsBalls);

  const striker = byId(state?.strikerId);
  const nonStriker = byId(state?.nonStrikerId);
  const bowler = byId(state?.bowlerId);
  const bwl = state?.bowlerId ? bowling[state.bowlerId] : undefined;

  const timeline = buildOverTimeline(inningsBalls, innings);
  const currentOver = timeline[timeline.length - 1];

  const target = state?.target ?? null;
  const ballsBowled = totals.legalBalls;
  const ballsLeft = match.total_overs * 6 - ballsBowled;

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-6 pitch-waves animate-chalk-in">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 n-label">
          <span className="h-2 w-2 rounded-full bg-destructive live-blip" />
          LIVE · INN {innings}
        </span>
        <span className="n-label truncate">{match.total_overs} OV</span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-display tracking-widest text-base sm:text-xl truncate">{battingTeam}</div>
          <div className="font-dot text-4xl sm:text-6xl leading-none mt-1">
            {totals.runs}
            <span className="text-muted-foreground">/{totals.wickets}</span>
            <span className="text-lg sm:text-2xl text-muted-foreground ml-2">({oversString(totals.legalBalls)})</span>
          </div>
          <div className="n-label mt-1.5">
            CRR {runRate(totals.runs, totals.legalBalls).toFixed(2)} · V {bowlingTeam}
          </div>
        </div>
        {target ? (
          <div className="text-right">
            <div className="n-label">TARGET {target}</div>
            <div className="font-dot text-lg sm:text-2xl text-accent">
              {Math.max(0, target - totals.runs)} off {Math.max(0, ballsLeft)}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 n-rule" />

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="chalk-board rounded-2xl p-3">
          <div className="n-label mb-2">BATTING</div>
          <BatRow player={striker} line={striker ? batting[striker.id] : undefined} onStrike />
          <BatRow player={nonStriker} line={nonStriker ? batting[nonStriker.id] : undefined} />
        </div>
        <div className="chalk-board rounded-2xl p-3">
          <div className="n-label mb-2">BOWLING</div>
          <div className="flex items-center gap-2 min-w-0">
            <Avatar player={bowler} />
            <span className="truncate text-sm">{bowler?.name ?? "—"}</span>
            <span className="ml-auto font-dot text-sm shrink-0">
              {bwl ? `${oversString(bwl.legalBalls)}-${bwl.maidens}-${bwl.runsConceded}-${bwl.wickets}` : "0.0-0-0-0"}
            </span>
          </div>
          <div className="mt-2 n-label">
            ECON {bwl ? bwl.economy.toFixed(2) : "0.00"}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="n-label mb-1.5">THIS OVER · {currentOver ? currentOver.over + 1 : 1}</div>
        <div className="flex flex-wrap gap-1.5">
          {(currentOver?.balls ?? []).map((b, i) => (
            <span
              key={i}
              className={`h-8 min-w-8 px-2 rounded-full grid place-items-center font-dot text-xs border ${
                b.isWicket
                  ? "bg-destructive/20 text-destructive border-destructive/40"
                  : b.runs >= 4
                    ? "bg-accent/20 text-accent border-accent/40"
                    : "bg-secondary text-muted-foreground border-border"
              }`}
            >
              {b.label}
            </span>
          ))}
          {(!currentOver || currentOver.balls.length === 0) && <span className="n-label">yet to begin</span>}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <PinLiveButton />
        <Link
          to="/matches/$id"
          params={{ id: match.id }}
          className="rounded-full bg-destructive text-destructive-foreground px-4 py-2 font-display tracking-widest text-xs sm:text-sm hover:opacity-90"
        >
          OPEN SCORECARD →
        </Link>
      </div>
    </div>
  );
}

function Avatar({ player }: { player?: Player }) {
  if (!player) return <span className="h-7 w-7 rounded-full bg-secondary border border-border shrink-0" />;
  return player.photo_url ? (
    <img src={player.photo_url} alt={player.name} className="h-7 w-7 rounded-full object-cover border border-primary/30 shrink-0" />
  ) : (
    <span className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 text-primary grid place-items-center text-[10px] font-display shrink-0">
      {player.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function BatRow({
  player,
  line,
  onStrike,
}: {
  player?: Player;
  line?: { runs: number; ballsFaced: number };
  onStrike?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0 py-1">
      <Avatar player={player} />
      <span className="truncate text-sm">
        {player?.name ?? "—"}
        {onStrike && player ? <span className="text-accent ml-1">*</span> : null}
      </span>
      <span className="ml-auto font-dot text-sm shrink-0">
        {line ? `${line.runs} (${line.ballsFaced})` : "0 (0)"}
      </span>
    </div>
  );
}
