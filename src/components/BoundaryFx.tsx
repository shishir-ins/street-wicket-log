import { useEffect, useState } from "react";

type Fx = { id: number; runs: number };

export function BoundaryFx() {
  const [fx, setFx] = useState<Fx | null>(null);

  useEffect(() => {
    const onFx = (e: Event) => {
      const runs = (e as CustomEvent<{ runs: number }>).detail?.runs ?? 4;
      setFx({ id: Date.now(), runs });
      setTimeout(() => setFx(null), 1800);
    };
    window.addEventListener("boundary", onFx as EventListener);
    return () => window.removeEventListener("boundary", onFx as EventListener);
  }, []);

  if (!fx) return null;
  const isSix = fx.runs === 6;
  const label = isSix ? "SIX!" : "FOUR!";
  const colors = isSix
    ? ["#e94560", "#f7d060", "#3ddc97", "#4dabf7", "#a06cd5"]
    : ["#3ddc97", "#f7d060", "#4dabf7", "#ffffff"];

  return (
    <div className="fixed inset-0 z-[9990] pointer-events-none overflow-hidden">
      {/* shockwave */}
      <div
        className="absolute left-1/2 top-1/2 w-8 h-8 rounded-full"
        style={{
          background: isSix ? "oklch(0.7 0.2 25 / 0.5)" : "oklch(0.7 0.17 150 / 0.5)",
          transform: "translate(-50%,-50%)",
          animation: "shockwave 1.2s ease-out forwards",
        }}
      />
      {/* confetti */}
      {Array.from({ length: isSix ? 80 : 40 }).map((_, i) => {
        const c = colors[i % colors.length];
        const left = Math.random() * 100;
        const size = 6 + Math.random() * 8;
        const delay = Math.random() * 0.3;
        const dur = 1.4 + Math.random() * 0.8;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: "-10vh",
              width: size, height: size * 0.4,
              background: c,
              borderRadius: 2,
              animation: `confetti-fall ${dur}s linear ${delay}s forwards`,
            }}
          />
        );
      })}
      {/* main label */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="font-display tracking-[0.15em]"
          style={{
            fontSize: "clamp(6rem, 18vw, 14rem)",
            color: isSix ? "oklch(0.75 0.2 25)" : "oklch(0.78 0.16 80)",
            textShadow: `0 0 60px ${isSix ? "oklch(0.7 0.22 25 / 0.8)" : "oklch(0.78 0.16 80 / 0.7)"}`,
            animation: "boundary-pop 1.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            WebkitTextStroke: "2px oklch(0.15 0.02 150)",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}