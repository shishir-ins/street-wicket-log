import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import {
  computeBatting, computeBowling, computeFielding,
  type Ball, type Player, type Match,
} from "@/lib/cricket";
import { Trophy, Target, Flame, Hand, Activity, Calendar } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BELLAMLABIDI — Gully Cricket Pitch" },
      { name: "description", content: "Live dashboard: today's matches, leaderboards, top run scorers and wicket takers." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const playersQ = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*").order("name");
      if (error) throw error;
      return data as Player[];
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
  const ballsQ = useQuery({
    queryKey: ["balls", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("balls").select("*").order("created_at");
      if (error) throw error;
      return data as Ball[];
    },
  });

  const players = playersQ.data ?? [];
  const matches = matchesQ.data ?? [];
  const balls = ballsQ.data ?? [];

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfDay - now.getDay() * 86400000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const isAfter = (d: string, t: number) => new Date(d).getTime() >= t;

  const todayCount = matches.filter((m) => isAfter(m.match_date, startOfDay)).length;
  const weekCount = matches.filter((m) => isAfter(m.match_date, startOfWeek)).length;
  const monthCount = matches.filter((m) => isAfter(m.match_date, startOfMonth)).length;

  // Period filter for awards
  const [period, setPeriod] = useState<"all" | "today" | "week" | "month">("all");
  const periodStart = period === "today" ? startOfDay : period === "week" ? startOfWeek : period === "month" ? startOfMonth : 0;
  const allowedMatchIds = new Set(matches.filter((m) => new Date(m.match_date).getTime() >= periodStart).map((m) => m.id));
  const periodBalls = period === "all" ? balls : balls.filter((b) => allowedMatchIds.has(b.match_id));

  const batting = computeBatting(periodBalls);
  const bowling = computeBowling(periodBalls);
  const fielding = computeFielding(periodBalls);

  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? "—";

  const topRuns = Object.values(batting).sort((a, b) => b.runs - a.runs).slice(0, 5);
  const topWickets = Object.values(bowling).sort((a, b) => b.wickets - a.wickets).slice(0, 5);
  const topSR = Object.values(batting).filter((b) => b.ballsFaced >= 6).sort((a, b) => b.strikeRate - a.strikeRate).slice(0, 5);
  const topEco = Object.values(bowling).filter((b) => b.legalBalls >= 6).sort((a, b) => a.economy - b.economy).slice(0, 5);
  const topSixes = Object.values(batting).sort((a, b) => b.sixes - a.sixes).slice(0, 5);
  const topCatches = Object.entries(fielding).sort(([, a], [, b]) => b.catches - a.catches).slice(0, 5);

  const liveMatch = matches.find((m) => m.status === "live" || m.status === "innings_break" || m.status === "match_break");

  return (
    <AppShell>
      <section className="mb-8">
        <div className="chalk-board p-6 sm:p-10 animate-chalk-in">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="tape-tag text-sm">EST. 2026</span>
              <h1 className="mt-3 text-4xl sm:text-6xl font-display tracking-widest">
                THE PITCH<span className="text-primary">.</span>
              </h1>
              <p className="font-chalk text-xl text-chalk-dim mt-1" style={{ color: "var(--chalk-dim)" }}>
                where every gully match becomes history
              </p>
            </div>
            {liveMatch ? (
              <Link
                to="/matches/$id"
                params={{ id: liveMatch.id }}
                className="rounded-lg bg-destructive text-destructive-foreground px-4 py-3 font-display tracking-widest text-sm shadow-[var(--shadow-chalk-glow)] hover:opacity-90"
              >
                ● LIVE — {liveMatch.team_a_name} v {liveMatch.team_b_name}
              </Link>
            ) : (
              <Link
                to="/matches/new"
                className="rounded-lg bg-primary text-primary-foreground px-4 py-3 font-display tracking-widest text-sm hover:opacity-90"
              >
                START A MATCH
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
        <StatTile icon={Calendar} label="Today" value={todayCount} suffix="matches" />
        <StatTile icon={Flame} label="This week" value={weekCount} suffix="matches" />
        <StatTile icon={Activity} label="This month" value={monthCount} suffix="matches" />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8">
        <div className="md:col-span-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-display tracking-widest text-muted-foreground mr-1">AWARDS:</span>
          {(["all", "today", "week", "month"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`text-xs font-display tracking-wider px-3 py-1.5 rounded-md border ${period === p ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground border-border hover:bg-secondary/70"}`}>
              {p === "all" ? "All-time" : p === "today" ? "Today" : p === "week" ? "This week" : "This month"}
            </button>
          ))}
        </div>
        <Leaderboard title="Top Run Scorers" icon={Trophy} rows={topRuns.map((r) => ({ name: playerName(r.playerId), main: r.runs, sub: `${r.fours}×4  ${r.sixes}×6` }))} mainLabel="Runs" />
        <Leaderboard title="Top Wicket Takers" icon={Target} rows={topWickets.map((r) => ({ name: playerName(r.playerId), main: r.wickets, sub: `Eco ${r.economy.toFixed(2)}` }))} mainLabel="Wkts" />
        <Leaderboard title="Best Strike Rates" icon={Flame} rows={topSR.map((r) => ({ name: playerName(r.playerId), main: r.strikeRate.toFixed(1), sub: `${r.runs}(${r.ballsFaced})` }))} mainLabel="SR" />
        <Leaderboard title="Best Economy" icon={Target} rows={topEco.map((r) => ({ name: playerName(r.playerId), main: r.economy.toFixed(2), sub: `${r.wickets}w` }))} mainLabel="Eco" />
        <Leaderboard title="Most Sixes" icon={Flame} rows={topSixes.map((r) => ({ name: playerName(r.playerId), main: r.sixes, sub: `${r.runs} runs` }))} mainLabel="6s" />
        <Leaderboard title="Most Catches" icon={Hand} rows={topCatches.map(([id, f]) => ({ name: playerName(id), main: f.catches, sub: `${f.runOuts} run-outs` }))} mainLabel="Ct" />
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-display tracking-widest">Recent matches</h2>
          <Link to="/matches" className="text-sm font-display tracking-wider text-primary hover:underline">See all →</Link>
        </div>
        <div className="grid gap-3">
          {matches.length === 0 && (
            <div className="chalk-board p-8 text-center">
              <p className="font-chalk text-xl text-muted-foreground">No matches yet. Bring out the bat!</p>
            </div>
          )}
          {matches.slice(0, 5).map((m) => (
            <Link
              key={m.id}
              to="/matches/$id"
              params={{ id: m.id }}
              className="chalk-board p-4 flex items-center justify-between hover:translate-y-[-1px] transition"
            >
              <div>
                <div className="font-display tracking-widest text-lg">{m.team_a_name} <span className="text-muted-foreground">vs</span> {m.team_b_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{new Date(m.match_date).toLocaleString()} · {m.total_overs} overs</div>
              </div>
              <span className={`text-xs font-display tracking-wider px-2 py-1 rounded ${statusBadge(m.status)}`}>
                {m.status.replace("_", " ")}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function statusBadge(s: string) {
  if (s === "live" || s === "innings_break" || s === "match_break") return "bg-destructive/20 text-destructive";
  if (s === "completed") return "bg-primary/20 text-primary";
  return "bg-secondary text-muted-foreground";
}

function StatTile({ icon: Icon, label, value, suffix }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; suffix: string }) {
  return (
    <div className="chalk-board p-4 sm:p-5 animate-chalk-in">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-display tracking-wider">
        <Icon className="h-4 w-4" />{label.toUpperCase()}
      </div>
      <div className="score-tile text-4xl sm:text-5xl mt-2 text-primary">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{suffix}</div>
    </div>
  );
}

function Leaderboard({
  title, icon: Icon, rows, mainLabel,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: { name: string; main: number | string; sub: string }[];
  mainLabel: string;
}) {
  return (
    <div className="chalk-board p-5 animate-chalk-in">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display tracking-widest text-base flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{title}</h3>
        <span className="text-xs text-muted-foreground font-display tracking-wider">{mainLabel}</span>
      </div>
      {rows.length === 0 ? (
        <p className="font-chalk text-muted-foreground text-sm">No data yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 last:border-0 last:pb-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`font-display text-sm w-6 text-center ${i === 0 ? "text-accent" : "text-muted-foreground"}`}>{i + 1}</span>
                <span className="truncate font-medium">{r.name}</span>
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
