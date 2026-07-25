import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import type { Match } from "@/lib/cricket";
import { useAdmin, AdminLockButton } from "@/lib/admin";

export const Route = createFileRoute("/matches")({
  head: () => ({
    meta: [
      { title: "Matches — BELLAMLABIDI" },
      { name: "description", content: "Full match history with scores and results." },
    ],
  }),
  component: MatchesLayout,
});

function MatchesLayout() {
  const matchRoute = useMatchRoute();
  // If a child route (new / $id) matched, render only the outlet.
  const isChild = matchRoute({ to: "/matches/new" }) || matchRoute({ to: "/matches/$id", fuzzy: true });
  if (isChild) return <Outlet />;
  return <MatchesList />;
}

function MatchesList() {
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

  return (
    <AppShell>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <span className="tape-tag text-xs">THE BOOK</span>
          <h1 className="text-4xl font-display tracking-widest mt-2">Match History</h1>
          <p className="font-chalk text-lg text-muted-foreground">every gully battle, saved.</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <Link to="/matches/new" className="rounded-md bg-primary text-primary-foreground px-4 py-2 font-display tracking-wide hover:opacity-90">
              + New match
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground font-chalk">🔒 admin only</span>
          )}
          <AdminLockButton />
        </div>
      </div>
      <div className="grid gap-3">
        {matches.map((m) => (
          <Link key={m.id} to="/matches/$id" params={{ id: m.id }} className="chalk-board p-4 flex items-center justify-between hover:translate-y-[-1px] transition">
            <div>
              <div className="font-display tracking-widest text-lg">{m.team_a_name} <span className="text-muted-foreground">vs</span> {m.team_b_name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{new Date(m.match_date).toLocaleString()} · {m.total_overs} overs</div>
              {m.result && (m.result as { summary?: string }).summary ? (
                <div className="text-sm mt-1 font-chalk text-accent">{(m.result as { summary: string }).summary}</div>
              ) : null}
            </div>
            <span className={`text-xs font-display tracking-wider px-2 py-1 rounded ${badge(m.status)}`}>
              {m.status.replace("_", " ")}
            </span>
          </Link>
        ))}
        {matches.length === 0 && (
          <div className="chalk-board p-8 text-center font-chalk text-muted-foreground text-xl">
            No matches yet — start your first one.
          </div>
        )}
      </div>
    </AppShell>
  );
}

function badge(s: string) {
  if (s === "live" || s === "innings_break" || s === "match_break") return "bg-destructive/20 text-destructive";
  if (s === "completed") return "bg-primary/20 text-primary";
  return "bg-secondary text-muted-foreground";
}