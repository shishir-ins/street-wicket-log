import { supabase } from "@/integrations/supabase/client";
import type { Ball } from "@/lib/cricket";

const PAGE = 1000;

/**
 * Fetch every ball row, paging past PostgREST's 1000-row response cap.
 * `filter` can narrow the query (e.g. a player's involvement).
 */
export async function fetchAllBalls(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter?: (q: any) => any,
): Promise<Ball[]> {
  const out: Ball[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from("balls").select("*").order("created_at").range(from, from + PAGE - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as Ball[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}
