import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { PLAYER_ROLES, type Player, type PlayerRole } from "@/lib/cricket";
import { Search, UserPlus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/players")({
  head: () => ({
    meta: [
      { title: "Squad — BELLAMLABIDI" },
      { name: "description", content: "All players, roles and quick profiles for our cricket crew." },
    ],
  }),
  component: PlayersPage,
});

function PlayersPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [role, setRole] = useState<PlayerRole>("All-rounder");
  const [q, setQ] = useState("");

  const playersQ = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*").order("name");
      if (error) throw error;
      return data as Player[];
    },
  });

  const addPlayer = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name required");
      const { error } = await supabase.from("players").insert({ name: trimmed, role });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["players"] });
    },
  });

  const removePlayer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players"] }),
  });

  const list = (playersQ.data ?? []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <AppShell>
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <span className="tape-tag text-xs">THE SQUAD</span>
          <h1 className="text-4xl font-display tracking-widest mt-2">Players</h1>
          <p className="font-chalk text-lg text-muted-foreground">tap a name to see their career.</p>
        </div>
        <div className="text-sm text-muted-foreground font-display tracking-widest">
          {playersQ.data?.length ?? 0} REGISTERED
        </div>
      </div>

      <div className="chalk-board p-5 mb-6">
        <h2 className="font-display tracking-widest mb-3 flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" />Add player</h2>
        <form
          className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-3"
          onSubmit={(e) => { e.preventDefault(); addPlayer.mutate(); }}
        >
          <input
            className="bg-input/40 border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Player name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="bg-input/40 border border-border rounded-md px-3 py-2 text-foreground"
            value={role}
            onChange={(e) => setRole(e.target.value as PlayerRole)}
          >
            {PLAYER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            type="submit"
            disabled={addPlayer.isPending || !name.trim()}
            className="btn-chalk rounded-md px-4 py-2 bg-primary/20 text-primary disabled:opacity-50"
          >
            {addPlayer.isPending ? "Adding…" : "Add"}
          </button>
        </form>
        {addPlayer.error ? <p className="text-destructive text-sm mt-2">{(addPlayer.error as Error).message}</p> : null}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full bg-input/40 border border-border rounded-md pl-9 pr-3 py-2"
            placeholder="Search players…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((p) => (
          <div key={p.id} className="chalk-board p-4 flex items-center gap-3 group">
            <Link to="/players/$id" params={{ id: p.id }} className="flex items-center gap-3 flex-1 min-w-0">
              {p.photo_url ? (
                <img src={p.photo_url} alt={p.name} className="h-12 w-12 rounded-full object-cover border border-primary/30 shrink-0" />
              ) : (
                <span className="h-12 w-12 rounded-full bg-primary/15 border border-primary/30 text-primary flex items-center justify-center font-display text-lg shrink-0">
                  {p.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <div className="font-display text-lg tracking-wide truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.role}</div>
              </div>
            </Link>
            <button
              onClick={() => { if (confirm(`Remove ${p.name}?`)) removePlayer.mutate(p.id); }}
              className="p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition"
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {list.length === 0 && !playersQ.isLoading && (
          <p className="font-chalk text-muted-foreground col-span-full text-center py-8">No players found.</p>
        )}
      </div>
    </AppShell>
  );
}