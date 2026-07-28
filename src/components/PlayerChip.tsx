import { Link } from "@tanstack/react-router";
import type { Player } from "@/lib/cricket";

export function PlayerChip({
  player,
  joker,
  size = "sm",
  linkTo = true,
  suffix,
}: {
  player?: Player;
  joker?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  linkTo?: boolean;
  suffix?: string;
}) {
  if (!player) return <span className="text-muted-foreground">—</span>;
  const dims =
    size === "xs" ? "h-6 w-6 text-[10px]" :
    size === "sm" ? "h-8 w-8 text-xs" :
    size === "md" ? "h-10 w-10 text-sm" :
    "h-14 w-14 text-base";
  const avatar = player.photo_url ? (
    <img src={player.photo_url} alt={player.name} className={`${dims} rounded-full object-cover border border-primary/30 shrink-0`} />
  ) : (
    <span className={`${dims} rounded-full bg-primary/15 border border-primary/30 text-primary flex items-center justify-center font-display shrink-0`}>
      {player.name.slice(0, 2).toUpperCase()}
    </span>
  );
  const inner = (
    <span className={`inline-flex items-center gap-2 min-w-0 ${joker ? "joker-shine rounded-full pl-0.5 pr-2 py-0.5" : ""}`}>
      {avatar}
      <span className="min-w-0 truncate font-medium">
        {joker && <span className="mr-1" aria-hidden>🃏</span>}
        {player.name}
        {suffix ? <span className="text-muted-foreground text-xs ml-1">{suffix}</span> : null}
      </span>
    </span>
  );
  if (!linkTo) return inner;
  return (
    <Link to="/players/$id" params={{ id: player.id }} className="hover:text-primary transition">
      {inner}
    </Link>
  );
}