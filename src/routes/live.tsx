import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useLiveMatch } from "@/components/LiveBar";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live Match — BELLAMLABIDI" },
      { name: "description", content: "Jump straight to the match being played right now, ball by ball." },
      { property: "og:title", content: "Live Match — BELLAMLABIDI" },
      { property: "og:description", content: "Jump straight to the match being played right now, ball by ball." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LiveRedirect,
});

function LiveRedirect() {
  const match = useLiveMatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (match) navigate({ to: "/matches/$id", params: { id: match.id }, replace: true });
  }, [match, navigate]);

  return (
    <AppShell>
      <div className="chalk-board rounded-3xl p-10 text-center">
        <div className="n-label">LIVE</div>
        <h1 className="font-dot text-3xl mt-3">{match ? "Opening the live match…" : "No match live right now"}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {match ? "Hang tight." : "This shortcut opens the live match the moment one starts."}
        </p>
        <Link to="/" className="btn-chalk rounded-full px-5 py-2 text-xs inline-block mt-6">GO TO PITCH</Link>
      </div>
    </AppShell>
  );
}
