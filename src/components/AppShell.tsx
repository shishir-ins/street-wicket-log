import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Home, Users, ListChecks, PlayCircle, Trophy } from "lucide-react";

const navItems = [
  { to: "/" as const, label: "Pitch", icon: Home, color: "#22c55e" },        // green
  { to: "/players" as const, label: "Squad", icon: Users, color: "#38bdf8" }, // sky blue
  { to: "/matches" as const, label: "Matches", icon: ListChecks, color: "#facc15" }, // yellow
  { to: "/awards" as const, label: "Awards", icon: Trophy, color: "#f472b6" },       // pink
];

const pageColorFor = (path: string): string => {
  if (path.startsWith("/players")) return "#38bdf8"; // sky
  if (path.startsWith("/matches")) return "#facc15"; // yellow
  if (path.startsWith("/awards")) return "#f472b6"; // pink
  return "#22c55e"; // home / green
};

const activeIndexFor = (path: string): number => {
  if (path.startsWith("/players")) return 1;
  if (path.startsWith("/matches")) return 2;
  if (path.startsWith("/awards")) return 3;
  return 0;
};

type PillBox = { left: number; width: number; ready: boolean };

/**
 * Measures nav items and animates one pill between them.
 * mode "circle": the pill rests as a circle centred on each item (mobile icons).
 * mode "auto":   the pill rests at the item's own width (desktop text tabs).
 * While travelling it stretches to span both the old and the new resting spot,
 * then snaps back to its resting shape.
 */
function usePill(activeIndex: number, mode: "circle" | "auto", circleSize = 46) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [box, setBox] = useState<PillBox>({ left: 0, width: 0, ready: false });
  const prevIndex = useRef(activeIndex);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restFor = useCallback(
    (index: number): { left: number; width: number } | null => {
      const el = itemRefs.current[index];
      const parent = containerRef.current;
      if (!el || !parent) return null;
      const p = parent.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const center = r.left - p.left + r.width / 2;
      const width = mode === "circle" ? circleSize : r.width;
      return { left: center - width / 2, width };
    },
    [mode, circleSize],
  );

  const settle = useCallback(() => {
    const rest = restFor(activeIndex);
    if (rest) setBox({ ...rest, ready: true });
  }, [restFor, activeIndex]);

  useLayoutEffect(() => {
    const from = prevIndex.current;
    const to = activeIndex;
    if (from === to) {
      settle();
      return;
    }
    prevIndex.current = to;
    const a = restFor(from);
    const b = restFor(to);
    if (a && b) {
      const left = Math.min(a.left, b.left);
      const right = Math.max(a.left + a.width, b.left + b.width);
      setBox({ left, width: right - left, ready: true });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(settle, 190);
    } else {
      settle();
    }
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [activeIndex, restFor, settle]);

  useEffect(() => {
    const onResize = () => settle();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [settle]);

  const setItemRef = (i: number) => (el: HTMLAnchorElement | null) => {
    itemRefs.current[i] = el;
  };

  return { containerRef, setItemRef, box };
}
export function AppShell({ children, themeColor }: { children: ReactNode; themeColor?: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const pageColor = themeColor ?? pageColorFor(path);
  const activeIndex = activeIndexFor(path);
  const desktop = usePill(activeIndex, "auto");
  const mobile = usePill(activeIndex, "circle", 46);

  return (
    <div className="min-h-screen flex flex-col page-theme" style={{ ["--page-color" as string]: pageColor }}>
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary border border-primary/30 font-display text-lg">
              B
            </span>
            <div className="flex flex-col leading-none">
              <span className="font-display text-xl tracking-widest text-foreground">BELLAMLABIDI</span>
              <span className="font-chalk text-xs text-muted-foreground -mt-0.5">gully cricket scoreboard</span>
            </div>
          </Link>
          <nav ref={desktop.containerRef} className="hidden md:flex items-center gap-1 relative">
            <span
              aria-hidden
              className="nav-pill"
              style={{
                opacity: desktop.box.ready ? 1 : 0,
                transform: `translateX(${desktop.box.left}px)`,
                width: desktop.box.width,
                ["--pill-color" as string]: pageColor,
              }}
            />
            {navItems.map((it, i) => (
              <Link
                key={it.to}
                to={it.to}
                ref={desktop.setItemRef(i)}
                style={{ ["--tab-color" as string]: it.color }}
                className="relative z-10 px-4 py-2 rounded-full text-sm font-display tracking-wide text-muted-foreground hover:text-[var(--tab-color)] transition-colors duration-300"
                activeProps={{ className: "relative z-10 px-4 py-2 rounded-full text-sm font-display tracking-wide text-[var(--tab-color)] transition-colors duration-300" }}
                activeOptions={{ exact: it.to === "/" }}
              >
                {it.label}
              </Link>
            ))}
          </nav>
          <Link
            to="/matches/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-display tracking-wide hover:opacity-90 transition shadow-[var(--shadow-chalk-glow)]"
          >
            <PlayCircle className="h-4 w-4" />
            New Match
          </Link>
        </div>
      </header>

      <main key={activeIndex} className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-10 page-enter">
        {children}
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background/90 backdrop-blur border-t border-border">
        <div ref={mobile.containerRef} className="grid grid-cols-4 max-w-md mx-auto relative">
          <span
            aria-hidden
            className="nav-pill nav-pill-mobile"
            style={{
              opacity: mobile.box.ready ? 1 : 0,
              transform: `translateX(${mobile.box.left}px)`,
              width: mobile.box.width,
              ["--pill-color" as string]: pageColor,
            }}
          />
          {navItems.map((it, i) => {
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                ref={mobile.setItemRef(i)}
                style={{ ["--tab-color" as string]: it.color }}
                className="relative z-10 flex flex-col items-center justify-center py-2.5 text-xs text-muted-foreground transition-colors duration-300"
                activeProps={{ className: "relative z-10 flex flex-col items-center justify-center py-2.5 text-xs text-[var(--tab-color)] transition-colors duration-300" }}
                activeOptions={{ exact: it.to === "/" }}
              >
                <Icon className="h-5 w-5 mb-0.5 transition-transform duration-300" />
                <span className="font-display tracking-wide">{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}