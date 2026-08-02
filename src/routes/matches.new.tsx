import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import type { Player, MatchState, Team } from "@/lib/cricket";
import { ArrowLeft, Check } from "lucide-react";
import { useAdmin, AdminLockButton } from "@/lib/admin";

// ---------- Saved team presets (stored in localStorage, per-day) ----------
interface SavedPreset {
  id: string;
  name: string;
  savedAt: string; // ISO date
  teamAName: string;
  teamBName: string;
  teamA: string[];
  teamB: string[];
  commonId: string;
  overs: number;
  battingFirst: Team;
}
const PRESETS_KEY = "bellamlabidi.teamPresets";
function loadPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SavedPreset[];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function savePresets(list: SavedPreset[]) {
  try { localStorage.setItem(PRESETS_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export const Route = createFileRoute("/matches/new")({
  head: () => ({ meta: [{ title: "New match — BELLAMLABIDI" }] }),
  component: NewMatch,
});

function NewMatch() {
  const { isAdmin } = useAdmin();
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
  // Toss
  const [tossCall, setTossCall] = useState<"heads" | "tails">("heads");
  const [flipping, setFlipping] = useState(false);
  const [coin, setCoin] = useState<"heads" | "tails" | null>(null);
  const [tossWinner, setTossWinner] = useState<Team | null>(null);
  const [tossDecision, setTossDecision] = useState<"bat" | "bowl" | null>(null);

  const flipCoin = () => {
    if (flipping) return;
    setFlipping(true);
    setCoin(null);
    setTossWinner(null);
    setTossDecision(null);
    const result: "heads" | "tails" = Math.random() < 0.5 ? "heads" : "tails";
    setTimeout(() => {
      setCoin(result);
      setTossWinner(result === tossCall ? "A" : "B");
      setFlipping(false);
    }, 1800);
  };
  const chooseDecision = (d: "bat" | "bowl") => {
    if (!tossWinner) return;
    setTossDecision(d);
    const batter: Team = d === "bat" ? tossWinner : (tossWinner === "A" ? "B" : "A");
    setBattingFirst(batter);
  };
  const [strikerId, setStrikerId] = useState("");
  const [nonStrikerId, setNonStrikerId] = useState("");
  const [bowlerId, setBowlerId] = useState("");

  const [presets, setPresets] = useState<SavedPreset[]>(() => (typeof window !== "undefined" ? loadPresets() : []));
  const [presetName, setPresetName] = useState("");

  const applyPreset = (p: SavedPreset) => {
    setTeamAName(p.teamAName); setTeamBName(p.teamBName);
    setTeamA(p.teamA); setTeamB(p.teamB);
    setCommonId(p.commonId); setOvers(p.overs);
    setBattingFirst(p.battingFirst);
  };
  const saveCurrentPreset = () => {
    const nm = (presetName || `${teamAName} vs ${teamBName}`).trim();
    if (!nm) return;
    const next: SavedPreset = {
      id: crypto.randomUUID(), name: nm, savedAt: new Date().toISOString(),
      teamAName, teamBName, teamA: [...teamA], teamB: [...teamB], commonId, overs, battingFirst,
    };
    const list = [next, ...presets].slice(0, 20);
    setPresets(list); savePresets(list); setPresetName("");
  };
  const updatePreset = (id: string) => {
    const list = presets.map((p) => p.id === id ? {
      ...p, teamAName, teamBName, teamA: [...teamA], teamB: [...teamB], commonId, overs, battingFirst, savedAt: new Date().toISOString(),
    } : p);
    setPresets(list); savePresets(list);
  };
  const deletePreset = (id: string) => {
    const list = presets.filter((p) => p.id !== id);
    setPresets(list); savePresets(list);
  };

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state: state as any,
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
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-4xl font-display tracking-widest">New Match</h1>
        <AdminLockButton />
      </div>
      <p className="font-chalk text-muted-foreground mb-6">Step {step} of 3</p>

      {!isAdmin && (
        <div className="chalk-board p-5 mb-6">
          <p className="font-chalk text-lg">🔒 Only the admin can start a new match. Tap the ADMIN button above to unlock.</p>
        </div>
      )}
      {isAdmin && (
      <>

      {players.length < 2 && (
        <div className="chalk-board p-5 mb-6">
          <p className="font-chalk text-lg">You need at least 2 players. <Link to="/players" className="text-primary underline">Add players →</Link></p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5 animate-chalk-in">
          {/* Saved presets */}
          <div className="chalk-board p-5">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <h2 className="font-display tracking-widest">Saved team presets</h2>
              <div className="flex gap-2">
                <input placeholder="Preset name (e.g. Sunday squad)" value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="bg-input/40 border border-border rounded-md px-3 py-1.5 text-sm w-56" />
                <button type="button" onClick={saveCurrentPreset}
                  disabled={teamA.length + teamB.length === 0}
                  className="btn-chalk rounded-md px-3 py-1.5 text-sm bg-primary/20 text-primary disabled:opacity-40">
                  💾 Save current
                </button>
              </div>
            </div>
            {presets.length === 0 ? (
              <p className="text-sm text-muted-foreground font-chalk">No saved presets yet. Pick teams below, then save so you can reuse them all day.</p>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-2">
                {presets.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 bg-background/30 border border-border rounded-md px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-display tracking-wide text-sm truncate">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {p.teamAName} ({p.teamA.length}) vs {p.teamBName} ({p.teamB.length}) · {p.overs}ov · {new Date(p.savedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button onClick={() => applyPreset(p)} className="btn-chalk rounded-md px-2 py-1 text-xs">Load</button>
                    <button onClick={() => updatePreset(p.id)} className="btn-chalk rounded-md px-2 py-1 text-xs" title="Overwrite with current selection">Update</button>
                    <button onClick={() => { if (confirm(`Delete preset "${p.name}"?`)) deletePreset(p.id); }}
                      className="btn-chalk rounded-md px-2 py-1 text-xs text-destructive border-destructive/40">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="chalk-board p-5">
            <h2 className="font-display tracking-widest mb-4">Teams & overs</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Team A name"><input className="w-full bg-input/40 border border-border rounded-md px-3 py-2" value={teamAName} onChange={(e) => setTeamAName(e.target.value)} /></Field>
              <Field label="Team B name"><input className="w-full bg-input/40 border border-border rounded-md px-3 py-2" value={teamBName} onChange={(e) => setTeamBName(e.target.value)} /></Field>
              <Field label="Overs per innings">
                <div className="space-y-2">
                  <input type="number" min={1} max={50} className="w-full bg-input/40 border border-border rounded-md px-3 py-2" value={overs} onChange={(e) => setOvers(Math.max(1, +e.target.value || 1))} />
                  <div className="flex flex-wrap gap-1.5">
                    {[4, 6, 8, 10, 12, 15, 20].map((n) => (
                      <button key={n} type="button" onClick={() => setOvers(n)}
                        className={`btn-chalk rounded-md px-2.5 py-1 text-xs ${overs === n ? "bg-primary/20 text-primary border-primary/50" : ""}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
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

          <div className="chalk-board p-5 relative overflow-hidden">
            <h3 className="font-display tracking-widest mb-2 flex items-center gap-2">
              <span className="inline-block px-2 py-0.5 rounded-md text-xs bg-gradient-to-r from-fuchsia-500 via-amber-400 to-emerald-400 text-black font-bold tracking-widest shadow-[0_0_20px_rgba(236,72,153,0.4)] animate-pulse">🃏 JOKER</span>
              <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </h3>
            <p className="text-sm text-muted-foreground mb-3 font-chalk">For odd numbers — the JOKER bats and bowls for both teams.</p>
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
            <h2 className="font-display tracking-widest mb-1">The Toss</h2>
            <p className="font-chalk text-muted-foreground mb-4">
              <span className="text-primary">{teamAName}</span> calls it. Spin the coin.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-xs mb-5">
              {(["heads", "tails"] as const).map((c) => (
                <button key={c} type="button" disabled={flipping} onClick={() => setTossCall(c)}
                  className={`btn-chalk rounded-md py-2 text-sm font-display tracking-widest ${tossCall === c ? "bg-primary/20 text-primary border-primary/60" : ""}`}>
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex flex-col items-center gap-4 py-2">
              <div className={`coin ${flipping ? "coin-flipping" : ""}`}>
                <span className="font-display tracking-widest text-xl">
                  {flipping ? "" : coin ? (coin === "heads" ? "H" : "T") : "?"}
                </span>
              </div>
              <button type="button" onClick={flipCoin} disabled={flipping}
                className="rounded-full bg-primary text-primary-foreground px-6 py-2 font-display tracking-widest disabled:opacity-50">
                {flipping ? "Spinning…" : coin ? "Flip again" : "Flip the coin"}
              </button>
              {coin && tossWinner && (
                <p className="font-chalk text-lg text-center">
                  It's <span className="text-accent">{coin.toUpperCase()}</span> —{" "}
                  <span className="text-primary">{tossWinner === "A" ? teamAName : teamBName}</span> won the toss.
                </p>
              )}
            </div>
            {tossWinner && (
              <div className="mt-4">
                <h3 className="font-display tracking-widest mb-2 text-sm text-muted-foreground">
                  {tossWinner === "A" ? teamAName : teamBName} elects to…
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {(["bat", "bowl"] as const).map((d) => (
                    <button key={d} type="button" onClick={() => chooseDecision(d)}
                      className={`p-5 rounded-md border text-center transition ${tossDecision === d ? "bg-primary/20 border-primary/60 text-primary" : "border-border bg-background/30 hover:bg-secondary"}`}>
                      <div className="font-display text-2xl tracking-widest">{d === "bat" ? "BAT" : "BOWL"}</div>
                      <div className="text-xs text-muted-foreground mt-1">first</div>
                    </button>
                  ))}
                </div>
                {tossDecision && (
                  <p className="font-chalk text-muted-foreground mt-3">
                    {battingFirst === "A" ? teamAName : teamBName} bats first.
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn-chalk rounded-md px-5 py-2">← Back</button>
            <button onClick={() => setStep(3)} disabled={!tossDecision}
              className="btn-chalk rounded-md px-5 py-2 bg-primary/20 text-primary disabled:opacity-40">Next →</button>
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
      </>
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