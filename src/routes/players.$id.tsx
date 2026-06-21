import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import {
  computeBatting, computeBowling, computeFielding,
  type Ball, type Player, type Match,
} from "@/lib/cricket";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/players/$id")({
  head: () => ({
    meta: [
      { title: "Player Profile — BELLAMLABIDI" },
      { name: "description", content: "Career stats and recent form for this player." },
    ],
  }),
  component: PlayerProfile,
});

function PlayerProfile() {
  const { id } = Route.useParams();
  const playerQ = useQuery({
    queryKey: ["player", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Player;
    },
  });
  const ballsQ = useQuery({
    queryKey: ["balls", "player", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("balls")
        .select("*")
        .or(`striker_id.eq.${id},bowler_id.eq.${id},fielder_id.eq.${id},out_player_id.eq.${id}`)
        .order("created_at");
      if (error) throw error;
      return data as Ball[];
    },
  });
  const matchesQ = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*").order("match_date", { ascending: false });
      if (error) throw error;
      return data as Match[];
    },
  });

  const balls = ballsQ.data ?? [];
  const matches = matchesQ.data ?? [];

  const bat = computeBatting(balls)[id];
  const bowl = computeBowling(balls)[id];
  const field = computeFielding(balls)[id];

  // matches played by this player
  const myMatchIds = new Set(balls.map((b) => b.match_id));
  const myMatches = matches.filter((m) => myMatchIds.has(m.id));

  // highest score per match
  let highest = 0;
  const innings = new Set<string>();
  const perMatch: Record<string, number> = {};
  for (const b of balls) {
    if (b.striker_id !== id) continue;
    if (b.extra_type === "wide" || b.extra_type === "bye" || b.extra_type === "leg_bye") continue;
    perMatch[b.match_id] = (perMatch[b.match_id] ?? 0) + (b.runs ?? 0);
    innings.add(`${b.match_id}-${b.innings_number}`);
  }
  for (const v of Object.values(perMatch)) if (v > highest) highest = v;

  if (playerQ.isLoading) return <AppShell><p className="font-chalk">Loading…</p></AppShell>;
  if (!playerQ.data) return <AppShell><p className="font-chalk">Player not found.</p></AppShell>;

  const p = playerQ.data;

  return (
    <AppShell>
      <Link to="/players" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Squad
      </Link>
      <div className="chalk-board p-6 sm:p-8 mb-6">
        <div className="flex items-center gap-5">
          <span className="h-20 w-20 rounded-full bg-primary/15 border border-primary/30 text-primary flex items-center justify-center font-display text-3xl">
            {p.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <span className="tape-tag text-xs">{p.role.toUpperCase()}</span>
            <h1 className="text-4xl sm:text-5xl font-display tracking-widest mt-2">{p.name}</h1>
            <p className="font-chalk text-muted-foreground">{myMatches.length} matches · {innings.size} innings</p>
          </div>
        </div>
      </div>

      <h2 className="font-display tracking-widest text-xl mb-3">Career Batting</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Runs" value={bat?.runs ?? 0} />
        <Stat label="Highest" value={highest} />
        <Stat label="Strike rate" value={bat ? bat.strikeRate.toFixed(1) : "—"} />
        <Stat label="Balls" value={bat?.ballsFaced ?? 0} />
        <Stat label="Fours" value={bat?.fours ?? 0} />
        <Stat label="Sixes" value={bat?.sixes ?? 0} />
        <Stat label="Average" value={(bat && innings.size) ? (bat.runs / innings.size).toFixed(1) : "—"} />
        <Stat label="Innings" value={innings.size} />
      </div>

      <h2 className="font-display tracking-widest text-xl mb-3">Career Bowling</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Wickets" value={bowl?.wickets ?? 0} />
        <Stat label="Economy" value={bowl ? bowl.economy.toFixed(2) : "—"} />
        <Stat label="Maidens" value={bowl?.maidens ?? 0} />
        <Stat label="Balls bowled" value={bowl?.legalBalls ?? 0} />
      </div>

      <h2 className="font-display tracking-widest text-xl mb-3">Fielding</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Catches" value={field?.catches ?? 0} />
        <Stat label="Run outs" value={field?.runOuts ?? 0} />
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="chalk-board p-4">
      <div className="text-xs text-muted-foreground font-display tracking-wider">{label.toUpperCase()}</div>
      <div className="score-tile text-3xl text-primary mt-1">{value}</div>
    </div>
  );
}