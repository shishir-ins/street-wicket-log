import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import type { Match } from "@/lib/cricket";
import { Flame, Activity, Calendar, Trophy } from "lucide-react";
import { useAdmin, AdminLockButton } from "@/lib/admin";

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
  const { isAdmin } = useAdmin();
  const matchesQ = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*").order("match_date", { ascending: false });
      if (error) throw error;
      return data as Match[];
    },
  });
  const matches = matchesQ.data ?? [];

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfDay - now.getDay() * 86400000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const isAfter = (d: string, t: number) => new Date(d).getTime() >= t;

  const todayCount = matches.filter((m) => isAfter(m.match_date, startOfDay)).length;
  const weekCount = matches.filter((m) => isAfter(m.match_date, startOfWeek)).length;
  const monthCount = matches.filter((m) => isAfter(m.match_date, startOfMonth)).length;

  const liveMatch = matches.find((m) => m.status === "live" || m.status === "innings_break" || m.status === "match_break");

  return (
    <AppShell>
      <section className="mb-8">
        <div className="glass-card p-6 sm:p-10 animate-chalk-in pitch-waves sticker-bat rounded-3xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="tape-tag text-sm">EST. 2026</span>
              <h1 className="mt-3 text-4xl sm:text-6xl font-display tracking-widest">
                BELLAMLABIDI<span className="text-primary">.</span>
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
            ) : isAdmin ? (
              <Link
                to="/matches/new"
                className="rounded-lg bg-primary text-primary-foreground px-4 py-3 font-display tracking-widest text-sm hover:opacity-90"
              >
                START A MATCH
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-chalk">viewer mode</span>
                <AdminLockButton />
              </div>
            )}
          </div>
          {isAdmin && (
            <div className="mt-3 flex justify-end"><AdminLockButton /></div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
        <StatTile icon={Calendar} label="Today" value={todayCount} suffix="matches" />
        <StatTile icon={Flame} label="This week" value={weekCount} suffix="matches" />
        <StatTile icon={Activity} label="This month" value={monthCount} suffix="matches" />
      </section>

      <section className="mb-8">
        <Link to="/awards" className="glass-card block p-5 rounded-2xl sticker-ball hover:translate-y-[-1px] transition">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-accent" />
            <div>
              <div className="font-display tracking-widest text-lg">Awards & Leaderboards</div>
              <div className="text-xs text-muted-foreground">Top run scorers, wickets, hat-tricks — by day, week, month.</div>
            </div>
            <span className="ml-auto text-sm font-display tracking-wider text-primary">Open →</span>
          </div>
        </Link>
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
