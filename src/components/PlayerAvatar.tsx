import type { Player } from "@/lib/cricket";

const initials = (name?: string) =>
  (name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const sizeMap = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-7 w-7 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-sm",
} as const;

export function PlayerAvatar({
  player,
  size = "sm",
  isJoker = false,
  className = "",
}: {
  player?: Player;
  size?: keyof typeof sizeMap;
  isJoker?: boolean;
  className?: string;
}) {
  const wrap = `${sizeMap[size]} shrink-0 relative rounded-full overflow-hidden border border-border/60 bg-secondary flex items-center justify-center font-display tracking-wider ${isJoker ? "joker-glow" : ""} ${className}`;
  return (
    <span className={wrap}>
      {player?.photo_url ? (
        <img src={player.photo_url} alt={player?.name ?? ""} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="text-muted-foreground">{initials(player?.name)}</span>
      )}
      {isJoker && <span className="joker-sparkle" aria-hidden />}
    </span>
  );
}

export function PlayerNameRow({
  player,
  isJoker = false,
  size = "sm",
  suffix,
  className = "",
}: {
  player?: Player;
  isJoker?: boolean;
  size?: keyof typeof sizeMap;
  suffix?: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 min-w-0 ${className}`}>
      <PlayerAvatar player={player} size={size} isJoker={isJoker} />
      <span className={`truncate ${isJoker ? "joker-text" : ""}`}>{player?.name ?? "—"}</span>
      {isJoker && <span className="text-[10px] font-display tracking-widest px-1.5 py-0.5 rounded-md bg-accent/20 text-accent border border-accent/40">🃏 JOKER</span>}
      {suffix}
    </span>
  );
}