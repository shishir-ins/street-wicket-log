import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeInningsTotals, oversString, type Ball, type Match } from "@/lib/cricket";

const LIVE = ["live", "innings_break", "match_break"];

export function useLiveMatch() {
  const q = useQuery({
    queryKey: ["live-match"],
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .in("status", LIVE)
        .order("match_date", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as Match) ?? null;
    },
  });
  return q.data ?? null;
}

/** Floating mini scoreboard, pinned across every tab while a match is live. */
export function LiveBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const match = useLiveMatch();

  const ballsQ = useQuery({
    queryKey: ["live-bar-balls", match?.id],
    enabled: !!match,
    refetchInterval: 2500,
    queryFn: async () => {
      const { data, error } = await supabase.from("balls").select("*").eq("match_id", match!.id);
      if (error) throw error;
      return (data ?? []) as Ball[];
    },
  });

  if (!match) return null;
  // Hide while already inside that match page.
  if (path.startsWith(`/matches/${match.id}`)) return null;

  const balls = ballsQ.data ?? [];
  const innings = (match.current_innings as number) ?? 1;
  const totals = computeInningsTotals(balls, innings);
  const battingTeam =
    (innings === 1 ? match.batting_first : match.batting_first === "A" ? "B" : "A") === "A"
      ? match.team_a_name
      : match.team_b_name;

  return (
    <Link
      to="/matches/$id"
      params={{ id: match.id }}
      className="live-bar fixed left-3 right-3 bottom-20 md:bottom-4 md:left-auto md:right-4 md:w-[22rem] z-40 rounded-2xl px-4 py-2.5 flex items-center gap-3"
    >
      <span className="h-2 w-2 rounded-full bg-destructive live-blip shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="n-label truncate">{battingTeam} · INN {innings}</div>
        <div className="font-dot text-xl leading-tight truncate">
          {totals.runs}<span className="text-muted-foreground">/{totals.wickets}</span>{" "}
          <span className="text-sm text-muted-foreground">({oversString(totals.legalBalls)})</span>
        </div>
      </div>
      <span className="n-label shrink-0">OPEN →</span>
    </Link>
  );
}
