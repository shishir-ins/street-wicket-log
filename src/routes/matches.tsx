import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
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
  const qc = useQueryClient();
  const matchesQ = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*").order("match_date", { ascending: false });
      if (error) throw error;
      return data as Match[];
    },
  });
  const matches = matchesQ.data ?? [];

  const deleteMatch = useMutation({
    mutationFn: async (matchId: string) => {
      const { error: be } = await supabase.from("balls").delete().eq("match_id", matchId);
      if (be) throw be;
      const { error: me } = await supabase.from("matches").delete().eq("id", matchId);
      if (me) throw me;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });

  const onDelete = (m: Match, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const label = `${m.team_a_name} vs ${m.team_b_name}`;
    if (!confirm(`Delete match "${label}" and ALL its ball-by-ball data? This cannot be undone.`)) return;
    deleteMatch.mutate(m.id);
  };

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
          <Link key={m.id} to="/matches/$id" params={{ id: m.id }} className="chalk-board p-4 flex items-center justify-between gap-3 hover:translate-y-[-1px] transition">
            <div className="min-w-0 flex-1">
              <div className="font-display tracking-widest text-lg">{m.team_a_name} <span className="text-muted-foreground">vs</span> {m.team_b_name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{new Date(m.match_date).toLocaleString()} · {m.total_overs} overs</div>
              {m.result && (m.result as { summary?: string }).summary ? (
                <div className="text-sm mt-1 font-chalk text-accent">{(m.result as { summary: string }).summary}</div>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-display tracking-wider px-2 py-1 rounded ${badge(m.status)}`}>
                {m.status.replace("_", " ")}
              </span>
              {isAdmin && (
                <button
                  onClick={(e) => onDelete(m, e)}
                  disabled={deleteMatch.isPending}
                  className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition disabled:opacity-40"
                  aria-label="Delete match"
                  title="Delete match"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
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