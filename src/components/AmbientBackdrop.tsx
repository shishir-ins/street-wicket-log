import { useMemo } from "react";

// Inline cricket SVG icons drifting in the background.
function Bat({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="36" y="46" width="4" height="14" rx="1.5" fill="currentColor" transform="rotate(35 38 53)" />
      <rect x="14" y="8" width="20" height="40" rx="5" fill="currentColor" transform="rotate(35 24 28)" />
    </svg>
  );
}
function Ball({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="16" fill="currentColor" />
      <path d="M4 20 Q 20 12 36 20" stroke="oklch(0.15 0.02 150)" strokeWidth="1" fill="none" strokeDasharray="2 2" />
    </svg>
  );
}
function Helmet({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M12 36 Q 12 14 32 14 Q 52 14 52 36 L 52 44 L 12 44 Z" fill="currentColor" />
      <rect x="14" y="36" width="36" height="4" fill="oklch(0.15 0.02 150)" />
    </svg>
  );
}
function Stumps({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3">
      <line x1="20" y1="10" x2="20" y2="54" />
      <line x1="32" y1="10" x2="32" y2="54" />
      <line x1="44" y1="10" x2="44" y2="54" />
      <line x1="14" y1="10" x2="50" y2="10" />
    </svg>
  );
}
function Glove({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M14 32 Q 14 18 24 18 Q 28 18 30 22 Q 30 12 38 12 Q 44 12 44 22 Q 44 12 50 14 Q 54 20 52 32 L 52 50 Q 52 56 46 56 L 20 56 Q 14 56 14 50 Z" />
    </svg>
  );
}
function Flood({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <rect x="30" y="26" width="4" height="34" />
      <path d="M18 8 L 46 8 L 42 26 L 22 26 Z" />
    </svg>
  );
}

const ICONS = [Bat, Ball, Helmet, Stumps, Glove, Flood];

export function AmbientBackdrop() {
  const items = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => ({
      Cmp: ICONS[i % ICONS.length],
      top: `${Math.random() * 90}%`,
      left: `${Math.random() * 95}%`,
      size: 40 + Math.random() * 50,
      delay: `${Math.random() * 5}s`,
      duration: `${8 + Math.random() * 8}s`,
      rot: Math.random() * 360,
    }));
  }, []);

  return (
    <div aria-hidden className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {items.map((it, i) => {
        const Cmp = it.Cmp;
        return (
          <div
            key={i}
            className="ambient-icon"
            style={{
              top: it.top, left: it.left,
              animationDelay: it.delay,
              animationDuration: it.duration,
              transform: `rotate(${it.rot}deg)`,
            }}
          >
            <Cmp size={it.size} />
          </div>
        );
      })}
    </div>
  );
}