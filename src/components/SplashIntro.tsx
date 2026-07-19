import { useEffect, useState } from "react";

export function SplashIntro() {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("bl_splash_seen");
  });
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    sessionStorage.setItem("bl_splash_seen", "1");
    const t1 = setTimeout(() => setLeaving(true), 2100);
    const t2 = setTimeout(() => setShow(false), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: "radial-gradient(circle at 50% 55%, oklch(0.24 0.02 155), oklch(0.12 0.01 150) 70%)",
        animation: leaving ? "splash-out 0.55s ease forwards" : undefined,
      }}
    >
      {/* stadium floodlights */}
      <div className="absolute inset-0 opacity-40" aria-hidden>
        <div className="absolute -top-20 left-[15%] w-1 h-[70vh] rotate-[15deg] bg-gradient-to-b from-accent/60 to-transparent blur-md" />
        <div className="absolute -top-20 right-[15%] w-1 h-[70vh] -rotate-[15deg] bg-gradient-to-b from-accent/60 to-transparent blur-md" />
      </div>

      {/* flash */}
      <div
        className="absolute inset-0 bg-white"
        style={{ animation: "splash-flash 2.1s ease forwards", opacity: 0 }}
      />

      <div className="relative flex items-center gap-6">
        {/* Bat */}
        <svg width="220" height="220" viewBox="0 0 120 120" style={{ animation: "splash-bat 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) both", transformOrigin: "80% 80%" }}>
          <defs>
            <linearGradient id="bat" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="oklch(0.85 0.08 85)" />
              <stop offset="1" stopColor="oklch(0.55 0.1 60)" />
            </linearGradient>
          </defs>
          <rect x="70" y="88" width="8" height="24" rx="3" fill="oklch(0.35 0.05 40)" transform="rotate(35 74 100)" />
          <rect x="20" y="20" width="40" height="70" rx="10" fill="url(#bat)" stroke="oklch(0.4 0.06 40)" strokeWidth="1.5" transform="rotate(35 40 55)" />
        </svg>

        {/* Ball */}
        <div
          className="absolute left-[55%] top-[50%]"
          style={{
            animation: "splash-ball 2.1s cubic-bezier(0.22, 1, 0.36, 1) both",
          }}
        >
          <div
            style={{
              width: 36, height: 36, borderRadius: 999,
              background: "radial-gradient(circle at 35% 30%, oklch(0.75 0.2 25), oklch(0.42 0.18 25) 70%)",
              boxShadow: "0 0 30px oklch(0.62 0.22 25 / 0.8)",
            }}
          />
        </div>
      </div>

      {/* Title */}
      <div
        className="absolute bottom-[18%] left-1/2 -translate-x-1/2 text-center"
        style={{ animation: "chalk-in 0.8s ease 1.2s both" }}
      >
        <div className="font-display tracking-[0.4em] text-4xl sm:text-5xl text-foreground">BELLAMLABIDI</div>
        <div className="font-chalk text-lg text-muted-foreground mt-1">gully cricket, unforgettable.</div>
      </div>
    </div>
  );
}