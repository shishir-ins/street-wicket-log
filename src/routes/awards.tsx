import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { PlayerChip } from "@/components/PlayerChip";
import {
  computeBatting, computeBowling, computeFielding, computeHatTricks, computeMilestones,
  type Ball, type Player, type Match,
} from "@/lib/cricket";
import { Trophy, Target, Flame, Hand, Zap, Sparkles, Award, Crown } from "lucide-react";

export const Route = createFileRoute("/awards")({
  head: () => ({
    meta: [
      { title: "Awards & Leaderboards — BELLAMLABIDI" },
      { name: "description", content: "Top run scorers, wicket takers, hat-tricks and awards across time periods." },
    ],
  }),
  component: AwardsPage,
});

function AwardsPage() {
  const playersQ = useQuery({
    queryKey: ["players"],
    refetchInterval: 2000,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*").order("name");
      if (error) throw error;
      return data as Player[];
    },
  });
  const matchesQ = useQuery({
    queryKey: ["matches"],
    refetchInterval: 2000,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*").order("match_date", { ascending: false });
      if (error) throw error;
      return data as Match[];
    },
  });
  const ballsQ = useQuery({
    queryKey: ["balls", "all"],
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("balls").select("*").order("created_at");
      if (error) throw error;
      return data as Ball[];
    },
  });

  const players = playersQ.data ?? [];
  const matches = matchesQ.data ?? [];
  const balls = ballsQ.data ?? [];
  const byId: Record<string, Player> = Object.fromEntries(players.map((p) => [p.id, p]));

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfDay - now.getDay() * 86400000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const [period, setPeriod] = useState<"all" | "today" | "week" | "month">("all");
  const periodStart = period === "today" ? startOfDay : period === "week" ? startOfWeek : period === "month" ? startOfMonth : 0;
  const allowedMatchIds = new Set(matches.filter((m) => new Date(m.match_date).getTime() >= periodStart).map((m) => m.id));
  const scoped = period === "all" ? balls : balls.filter((b) => allowedMatchIds.has(b.match_id));

  const batting = computeBatting(scoped);
  const bowling = computeBowling(scoped);
  const fielding = computeFielding(scoped);
  const hatTricks = computeHatTricks(scoped);
  const milestones = computeMilestones(scoped);

  const topRuns = Object.values(batting).sort((a, b) => b.runs - a.runs).slice(0, 5);
  const topWickets = Object.values(bowling).sort((a, b) => b.wickets - a.wickets).slice(0, 5);
  const topSR = Object.values(batting).filter((b) => b.ballsFaced >= 6).sort((a, b) => b.strikeRate - a.strikeRate).slice(0, 5);
  const topEco = Object.values(bowling).filter((b) => b.legalBalls >= 6).sort((a, b) => a.economy - b.economy).slice(0, 5);
  const topSixes = Object.values(batting).sort((a, b) => b.sixes - a.sixes).slice(0, 5);
  const topFours = Object.values(batting).sort((a, b) => b.fours - a.fours).slice(0, 5);
  const topCatches = Object.entries(fielding).sort(([, a], [, b]) => b.catches - a.catches).slice(0, 5);
  const hatTrickRows = Object.entries(hatTricks).sort(([, a], [, b]) => b.count - a.count).slice(0, 5);
  const centuryRows = Object.entries(milestones).filter(([, m]) => m.hundreds > 0).sort(([, a], [, b]) => b.hundreds - a.hundreds).slice(0, 5);
  const fiftyRows = Object.entries(milestones).filter(([, m]) => m.fifties > 0 || m.hundreds > 0).sort(([, a], [, b]) => (b.fifties + b.hundreds) - (a.fifties + a.hundreds)).slice(0, 5);
  const highestRows = Object.entries(milestones).filter(([, m]) => m.highest > 0).sort(([, a], [, b]) => b.highest - a.highest).slice(0, 5);

  return (
    <AppShell>
      <div className="glass-card p-6 sm:p-8 mb-6 pitch-waves sticker-bat rounded-3xl">
        <span className="tape-tag text-xs">HALL OF FAME</span>
        <h1 className="text-4xl sm:text-5xl font-display tracking-widest mt-3">Awards</h1>
        <p className="font-chalk text-lg text-muted-foreground mt-1">the best of BELLAMLABIDI, by period.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["all", "today", "week", "month"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`text-xs font-display tracking-wider px-3 py-1.5 rounded-full border transition ${period === p ? "bg-primary text-primary-foreground border-primary shadow-[var(--shadow-chalk-glow)]" : "bg-secondary text-foreground border-border hover:bg-secondary/70"}`}>
              {p === "all" ? "All-time" : p === "today" ? "Today" : p === "week" ? "This week" : "This month"}
            </button>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <Leaderboard title="Top Run Scorers" icon={Trophy} rows={topRuns.map((r) => ({ id: r.playerId, main: r.runs, sub: `${r.fours}×4  ${r.sixes}×6` }))} mainLabel="Runs" byId={byId} />
        <Leaderboard title="Top Wicket Takers" icon={Target} rows={topWickets.map((r) => ({ id: r.playerId, main: r.wickets, sub: `Eco ${r.economy.toFixed(2)}` }))} mainLabel="Wkts" byId={byId} />
        <Leaderboard title="Hat-Tricks" icon={Sparkles} rows={hatTrickRows.map(([id, h]) => ({ id, main: h.count, sub: `${h.count} hat-trick${h.count>1?"s":""}` }))} mainLabel="H-T" byId={byId} />
        <Leaderboard title="Centuries" icon={Crown} rows={centuryRows.map(([id, m]) => ({ id, main: m.hundreds, sub: `HS ${m.highest}` }))} mainLabel="100s" byId={byId} />
        <Leaderboard title="Half-Centuries+" icon={Award} rows={fiftyRows.map(([id, m]) => ({ id, main: m.fifties + m.hundreds, sub: `${m.fifties}×50 · ${m.hundreds}×100` }))} mainLabel="50+" byId={byId} />
        <Leaderboard title="Highest Scores" icon={Trophy} rows={highestRows.map(([id, m]) => ({ id, main: m.highest, sub: `${m.hundreds}×100 ${m.fifties}×50` }))} mainLabel="HS" byId={byId} />
        <Leaderboard title="Best Strike Rates" icon={Zap} rows={topSR.map((r) => ({ id: r.playerId, main: r.strikeRate.toFixed(1), sub: `${r.runs}(${r.ballsFaced})` }))} mainLabel="SR" byId={byId} />
        <Leaderboard title="Best Economy" icon={Target} rows={topEco.map((r) => ({ id: r.playerId, main: r.economy.toFixed(2), sub: `${r.wickets}w` }))} mainLabel="Eco" byId={byId} />
        <Leaderboard title="Most Sixes" icon={Flame} rows={topSixes.map((r) => ({ id: r.playerId, main: r.sixes, sub: `${r.runs} runs` }))} mainLabel="6s" byId={byId} />
        <Leaderboard title="Most Fours" icon={Flame} rows={topFours.map((r) => ({ id: r.playerId, main: r.fours, sub: `${r.runs} runs` }))} mainLabel="4s" byId={byId} />
        <Leaderboard title="Most Catches" icon={Hand} rows={topCatches.map(([id, f]) => ({ id, main: f.catches, sub: `${f.runOuts} run-outs` }))} mainLabel="Ct" byId={byId} />
      </section>
    </AppShell>
  );
}

function Leaderboard({
  title, icon: Icon, rows, mainLabel, byId,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: { id: string; main: number | string; sub: string }[];
  mainLabel: string;
  byId: Record<string, Player>;
}) {
  return (
    <div className="glass-card p-5 rounded-2xl sticker-ball">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display tracking-widest text-base flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{title}</h3>
        <span className="text-xs text-muted-foreground font-display tracking-wider">{mainLabel}</span>
      </div>
      {rows.length === 0 ? (
        <p className="font-chalk text-muted-foreground text-sm">No data yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.id + i} className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 last:border-0 last:pb-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`font-display text-sm w-6 text-center ${i === 0 ? "text-accent" : "text-muted-foreground"}`}>{i + 1}</span>
                <PlayerChip player={byId[r.id]} />
              </div>
              <div className="text-right">
                <div className="score-tile text-lg text-primary">{r.main}</div>
                <div className="text-[10px] text-muted-foreground">{r.sub}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}