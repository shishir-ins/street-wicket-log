import { useEffect, useState } from "react";

export type CelebrationKind = "fifty" | "hundred" | "hattrick" | "six" | null;

/**
 * Full-screen overlay burst for milestones. Auto-dismisses after ~2.6s.
 * Renders nothing while `kind` is null.
 */
export function Celebration({ kind, name, onDone }: { kind: CelebrationKind; name?: string; onDone?: () => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!kind) return;
    setShow(true);
    const t = setTimeout(() => {
      setShow(false);
      onDone?.();
    }, kind === "hundred" ? 3400 : 2600);
    return () => clearTimeout(t);
  }, [kind, onDone]);

  if (!kind || !show) return null;

  const label =
    kind === "hundred" ? "CENTURY!" :
    kind === "fifty" ? "HALF-CENTURY!" :
    kind === "hattrick" ? "HAT-TRICK!" :
    "SIX!";
  const emoji =
    kind === "hundred" ? "💯" :
    kind === "fifty" ? "🏏" :
    kind === "hattrick" ? "🎩" : "💥";
  const color =
    kind === "hundred" ? "text-accent" :
    kind === "fifty" ? "text-primary" :
    kind === "hattrick" ? "text-destructive" : "text-accent";

  const confetti = Array.from({ length: kind === "hundred" ? 60 : 36 });

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fade-in_0.2s_ease-out]" />
      {confetti.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.4;
        const dur = 1.6 + Math.random() * 1.4;
        const hue = Math.floor(Math.random() * 360);
        const sway = (Math.random() * 200 - 100).toFixed(0);
        const rotEnd = Math.floor(Math.random() * 720 - 360);
        return (
          <span
            key={i}
            className="absolute top-[-6%] block"
            style={{
              left: `${left}%`,
              width: 10, height: 14,
              background: `hsl(${hue} 90% 60%)`,
              transform: "rotate(0deg)",
              animation: `confetti-fall ${dur}s ${delay}s cubic-bezier(.2,.7,.4,1) forwards`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ["--sway" as any]: `${sway}px`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ["--rot-end" as any]: `${rotEnd}deg`,
              borderRadius: 2,
              boxShadow: "0 0 6px rgba(255,255,255,0.4)",
            }}
          />
        );
      })}
      <div className="relative animate-[pop-in_0.5s_cubic-bezier(.2,1.3,.4,1)] text-center">
        <div className="text-7xl sm:text-9xl mb-2 drop-shadow-[0_0_30px_rgba(255,255,255,0.6)]">{emoji}</div>
        <div className={`font-display tracking-[0.2em] text-4xl sm:text-6xl ${color} drop-shadow-[0_0_20px_currentColor]`}>{label}</div>
        {name && <div className="mt-3 font-chalk text-2xl sm:text-3xl text-chalk">{name}</div>}
      </div>
    </div>
  );
}