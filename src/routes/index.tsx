import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import type { Match } from "@/lib/cricket";
import { Users, ListOrdered } from "lucide-react";
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
  const liveMatch = matches.find((m) => m.status === "live" || m.status === "innings_break" || m.status === "match_break");

  return (
    <AppShell>
      <section className="mb-8">
        <div className="chalk-board p-6 sm:p-10 animate-chalk-in">
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
            <div className="flex items-center gap-2">
              {!isAdmin && <span className="text-xs text-muted-foreground font-chalk">viewer mode</span>}
              <AdminLockButton />
            </div>
          </div>
        </div>
      </section>

      {liveMatch ? (
        <section className="mb-8 animate-chalk-in">
          <Link
            to="/matches/$id"
            params={{ id: liveMatch.id }}
            className="chalk-board block p-6 sm:p-8 border-destructive/40 hover:translate-y-[-2px] transition"
          >
            <div className="flex items-center gap-2 text-destructive font-display tracking-widest text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
              ● LIVE NOW — {liveMatch.status.replace("_", " ").toUpperCase()}
            </div>
            <div className="mt-3 text-3xl sm:text-4xl font-display tracking-widest">
              {liveMatch.team_a_name} <span className="text-muted-foreground">vs</span> {liveMatch.team_b_name}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{liveMatch.total_overs} overs · tap to watch</div>
          </Link>
        </section>
      ) : (
        <section className="mb-8 animate-chalk-in">
          <div className="chalk-board p-8 text-center">
            <p className="font-chalk text-xl text-muted-foreground">No live match right now.</p>
            {isAdmin && (
              <Link
                to="/matches/new"
                className="inline-block mt-4 rounded-lg bg-primary text-primary-foreground px-5 py-3 font-display tracking-widest text-sm hover:opacity-90"
              >
                START A MATCH
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:gap-4">
        <Link to="/matches" className="chalk-board p-5 flex items-center gap-3 hover:translate-y-[-1px] transition">
          <ListOrdered className="h-6 w-6 text-primary" />
          <div>
            <div className="font-display tracking-widest">MATCHES</div>
            <div className="text-xs text-muted-foreground">history & scorecards</div>
          </div>
        </Link>
        <Link to="/players" className="chalk-board p-5 flex items-center gap-3 hover:translate-y-[-1px] transition">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <div className="font-display tracking-widest">SQUAD</div>
            <div className="text-xs text-muted-foreground">players & stats</div>
          </div>
        </Link>
      </section>
    </AppShell>
  );
}
