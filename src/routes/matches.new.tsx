import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import type { Player, MatchState, Team } from "@/lib/cricket";
import { ArrowLeft, Check } from "lucide-react";

export const Route = createFileRoute("/matches/new")({
  head: () => ({ meta: [{ title: "New match — BELLAMLABIDI" }] }),
  component: NewMatch,
});

function NewMatch() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [teamAName, setTeamAName] = useState("Team A");
  const [teamBName, setTeamBName] = useState("Team B");
  const [overs, setOvers] = useState(6);
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [commonId, setCommonId] = useState<string>("");
  const [battingFirst, setBattingFirst] = useState<Team>("A");
  const [strikerId, setStrikerId] = useState("");
  const [nonStrikerId, setNonStrikerId] = useState("");
  const [bowlerId, setBowlerId] = useState("");

  const playersQ = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*").order("name");
      if (error) throw error;
      return data as Player[];
    },
  });
  const players = playersQ.data ?? [];
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);

  const togglePlayer = (id: string, team: Team) => {
    const [list, setList, otherList, setOther] = team === "A"
      ? [teamA, setTeamA, teamB, setTeamB] as const
      : [teamB, setTeamB, teamA, setTeamA] as const;
    if (list.includes(id)) setList(list.filter((x) => x !== id));
    else {
      setOther(otherList.filter((x) => x !== id));
      if (commonId === id) setCommonId("");
      setList([...list, id]);
    }
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!strikerId || !nonStrikerId || !bowlerId) throw new Error("Pick striker, non-striker and bowler");
      const battingTeam = battingFirst;
      const bowlingTeam: Team = battingTeam === "A" ? "B" : "A";
      const state: MatchState = {
        innings: 1,
        battingTeam,
        bowlingTeam,
        strikerId,
        nonStrikerId,
        bowlerId,
        ballIndex: 0,
        outBatsmen: [],
        target: null,
      };
      const { data, error } = await supabase.from("matches").insert({
        team_a_name: teamAName, team_b_name: teamBName,
        team_a_players: teamA, team_b_players: teamB,
        common_player_id: commonId || null,
        total_overs: overs,
        batting_first: battingFirst,
        status: "live",
        state: state as unknown as Record<string, unknown>,
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      navigate({ to: "/matches/$id", params: { id } });
    },
  });

  const battingList = battingFirst === "A" ? teamA : teamB;
  const bowlingList = battingFirst === "A" ? teamB : teamA;
  if (commonId) {
    if (!battingList.includes(commonId)) battingList.push(commonId);
    if (!bowlingList.includes(commonId)) bowlingList.push(commonId);
  }

  return (
    <AppShell>
      <Link to="/matches" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Matches
      </Link>
      <h1 className="text-4xl font-display tracking-widest mb-2">New Match</h1>
      <p className="font-chalk text-muted-foreground mb-6">Step {step} of 3</p>

      {players.length < 2 && (
        <div className="chalk-board p-5 mb-6">
          <p className="font-chalk text-lg">You need at least 2 players. <Link to="/players" className="text-primary underline">Add players →</Link></p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5 animate-chalk-in">
          <div className="chalk-board p-5">
            <h2 className="font-display tracking-widest mb-4">Teams & overs</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Team A name"><input className="w-full bg-input/40 border border-border rounded-md px-3 py-2" value={teamAName} onChange={(e) => setTeamAName(e.target.value)} /></Field>
              <Field label="Team B name"><input className="w-full bg-input/40 border border-border rounded-md px-3 py-2" value={teamBName} onChange={(e) => setTeamBName(e.target.value)} /></Field>
              <Field label="Overs per innings"><input type="number" min={1} max={50} className="w-full bg-input/40 border border-border rounded-md px-3 py-2" value={overs} onChange={(e) => setOvers(Math.max(1, +e.target.value || 1))} /></Field>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {(["A","B"] as Team[]).map((t) => {
              const name = t === "A" ? teamAName : teamBName;
              const list = t === "A" ? teamA : teamB;
              return (
                <div key={t} className="chalk-board p-5">
                  <h3 className="font-display tracking-widest mb-2">{name} <span className="text-muted-foreground text-sm">({list.length})</span></h3>
                  <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                    {players.map((p) => {
                      const onTeam = list.includes(p.id);
                      const onOther = t === "A" ? teamB.includes(p.id) : teamA.includes(p.id);
                      return (
                        <button key={p.id} type="button"
                          onClick={() => togglePlayer(p.id, t)}
                          disabled={onOther && !onTeam}
                          className={`text-left px-3 py-2 rounded-md border text-sm transition ${onTeam ? "bg-primary/20 border-primary/50 text-primary" : "border-border bg-background/30 hover:bg-secondary"} disabled:opacity-30`}>
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="chalk-board p-5">
            <h3 className="font-display tracking-widest mb-2">Common player (optional)</h3>
            <p className="text-sm text-muted-foreground mb-3 font-chalk">For odd numbers — this player bats for both teams.</p>
            <select className="bg-input/40 border border-border rounded-md px-3 py-2 w-full sm:w-80"
              value={commonId}
              onChange={(e) => {
                const id = e.target.value;
                setCommonId(id);
                if (id) { setTeamA(teamA.filter(x=>x!==id)); setTeamB(teamB.filter(x=>x!==id)); }
              }}>
              <option value="">— none —</option>
              {players.filter((p) => !teamA.includes(p.id) && !teamB.includes(p.id) || p.id === commonId).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <button
              disabled={teamA.length < 1 || teamB.length < 1}
              onClick={() => setStep(2)}
              className="btn-chalk rounded-md px-5 py-2 bg-primary/20 text-primary disabled:opacity-40">
              Next →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5 animate-chalk-in">
          <div className="chalk-board p-5">
            <h2 className="font-display tracking-widest mb-4">Who bats first?</h2>
            <div className="grid grid-cols-2 gap-3">
              {(["A","B"] as Team[]).map((t) => (
                <button key={t} type="button" onClick={() => setBattingFirst(t)}
                  className={`p-5 rounded-md border text-center transition ${battingFirst===t ? "bg-primary/20 border-primary/60 text-primary" : "border-border bg-background/30 hover:bg-secondary"}`}>
                  <div className="font-display text-2xl tracking-widest">{t === "A" ? teamAName : teamBName}</div>
                  <div className="text-xs text-muted-foreground mt-1">bats first</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn-chalk rounded-md px-5 py-2">← Back</button>
            <button onClick={() => setStep(3)} className="btn-chalk rounded-md px-5 py-2 bg-primary/20 text-primary">Next →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5 animate-chalk-in">
          <div className="chalk-board p-5">
            <h2 className="font-display tracking-widest mb-4">Openers & bowler</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Striker">
                <PlayerSelect value={strikerId} onChange={setStrikerId} ids={battingList} byId={byId} exclude={[nonStrikerId]} />
              </Field>
              <Field label="Non-striker">
                <PlayerSelect value={nonStrikerId} onChange={setNonStrikerId} ids={battingList} byId={byId} exclude={[strikerId]} />
              </Field>
              <Field label="Opening bowler">
                <PlayerSelect value={bowlerId} onChange={setBowlerId} ids={bowlingList} byId={byId} exclude={[]} />
              </Field>
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="btn-chalk rounded-md px-5 py-2">← Back</button>
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending || !strikerId || !nonStrikerId || !bowlerId}
              className="rounded-md bg-primary text-primary-foreground px-5 py-2 font-display tracking-widest disabled:opacity-50">
              {create.isPending ? "Starting…" : "Start Match ▶"}
            </button>
          </div>
          {create.error ? <p className="text-destructive text-sm">{(create.error as Error).message}</p> : null}
        </div>
      )}
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-display tracking-wider text-muted-foreground">{label.toUpperCase()}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function PlayerSelect({ value, onChange, ids, byId, exclude }: {
  value: string; onChange: (v: string) => void; ids: string[]; byId: Record<string, Player>; exclude: string[];
}) {
  return (
    <select className="w-full bg-input/40 border border-border rounded-md px-3 py-2"
      value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— select —</option>
      {ids.filter((id) => !exclude.includes(id)).map((id) => (
        <option key={id} value={id}>{byId[id]?.name ?? "?"}</option>
      ))}
    </select>
  );
}

export { Check }; // silence unused import warning if needed