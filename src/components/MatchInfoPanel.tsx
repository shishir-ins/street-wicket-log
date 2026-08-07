import { PlayerChip } from "@/components/PlayerChip";
import type { Match, MatchState, Player, Team } from "@/lib/cricket";

/** Info tab: teams, squads, toss and match settings. Monochrome mica look. */
export function MatchInfoPanel({
  match, byId, state, innings,
}: { match: Match; byId: Record<string, Player>; state: MatchState; innings: number }) {
  const teamName = (t: Team) => (t === "A" ? match.team_a_name : match.team_b_name);
  const ids = (t: Team) => ((t === "A" ? match.team_a_players : match.team_b_players) as unknown as string[]) ?? [];
  const joker = match.common_player_id ? byId[match.common_player_id] : undefined;
  const tossWinner = state.tossWinner ?? null;
  const tossDecision = state.tossDecision ?? null;

  return (
    <div className="space-y-4">
      <div className="mono-banner">
        <div className="text-[0.62rem] font-display tracking-[0.35em] opacity-60">MATCH FLYER</div>
        <h2 className="font-display tracking-widest text-2xl sm:text-4xl mt-2 leading-tight">
          {match.team_a_name} <span className="opacity-50">vs</span> {match.team_b_name}
        </h2>
        <div className="mt-2 text-xs opacity-70 font-chalk">
          {new Date(match.match_date).toLocaleString()} · {match.total_overs} overs a side · innings {innings}
        </div>
      </div>

      <div className="mono-flyer p-4">
        <div className="text-[0.62rem] font-display tracking-[0.3em] opacity-60">THE TOSS</div>
        {tossWinner ? (
          <p className="font-display tracking-wide text-lg mt-1.5">
            {teamName(tossWinner)} won the toss and chose to {tossDecision === "bowl" ? "bowl" : "bat"} first.
          </p>
        ) : (
          <p className="font-chalk text-sm opacity-70 mt-1.5">
            No toss recorded — {teamName(match.batting_first as Team)} batted first.
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {(["A", "B"] as Team[]).map((t) => (
          <div key={t} className="mono-flyer p-4">
            <div className="flex items-center justify-between">
              <div className="font-display tracking-widest text-lg">{teamName(t)}</div>
              <span className="text-[0.6rem] font-display tracking-[0.25em] opacity-60">
                {ids(t).length + (joker ? 1 : 0)} PLAYERS
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {ids(t).map((pid) => byId[pid]).filter(Boolean).map((p) => (
                <PlayerChip key={p.id} player={p} />
              ))}
              {joker && <PlayerChip player={joker} joker />}
            </div>
          </div>
        ))}
      </div>

      {joker && (
        <div className="mono-flyer p-4 text-xs font-chalk opacity-70">
          🃏 {joker.name} is the JOKER — plays for both sides.
        </div>
      )}
    </div>
  );
}