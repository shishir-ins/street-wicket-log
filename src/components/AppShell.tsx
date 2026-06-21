import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, Users, ListChecks, PlayCircle } from "lucide-react";

const navItems = [
  { to: "/" as const, label: "Pitch", icon: Home },
  { to: "/players" as const, label: "Squad", icon: Users },
  { to: "/matches" as const, label: "Matches", icon: ListChecks },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
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
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                className="px-3 py-2 rounded-md text-sm font-display tracking-wide text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                activeProps={{ className: "px-3 py-2 rounded-md text-sm font-display tracking-wide text-primary bg-primary/10" }}
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

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-10">
        {children}
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background/90 backdrop-blur border-t border-border">
        <div className="grid grid-cols-3 max-w-md mx-auto">
          {navItems.map((it) => {
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className="flex flex-col items-center justify-center py-2.5 text-xs text-muted-foreground"
                activeProps={{ className: "flex flex-col items-center justify-center py-2.5 text-xs text-primary" }}
                activeOptions={{ exact: it.to === "/" }}
              >
                <Icon className="h-5 w-5 mb-0.5" />
                <span className="font-display tracking-wide">{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}