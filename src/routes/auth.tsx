import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — BELLAMLABIDI" },
      { name: "description", content: "Sign in to score matches on the BELLAMLABIDI scoreboard." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/" });
    });
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      if (mode === "signin") {
        const creds = resolveCredentials(email, password);
        const { error } = await supabase.auth.signInWithPassword(creds);
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      }
      nav({ to: "/" });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally { setBusy(false); }
  };

  return (
    <AppShell>
      <div className="max-w-md mx-auto mt-8">
        <div className="chalk-board p-6">
          <span className="tape-tag text-xs">
            {mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
          </span>
          <h1 className="font-display tracking-widest text-3xl mt-3">
            {mode === "signin" ? "Welcome back" : "Join the crew"}
          </h1>
          <p className="font-chalk text-sm text-muted-foreground mb-5">
            {mode === "signin"
              ? "sign in to score matches. viewers don't need an account."
              : "the first person to sign up becomes admin — that's you."}
          </p>

          <form onSubmit={submit} className="space-y-3">
            <input
              type={mode === "signin" ? "text" : "email"} required
              autoComplete={mode === "signin" ? "username" : "email"}
              placeholder={mode === "signin" ? "email or username" : "you@example.com"}
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-input/40 border border-border rounded-md px-3 py-2"
            />
            <input
              type="password" required minLength={mode === "signin" ? 4 : 6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder={mode === "signin" ? "password" : "password (min 6 chars)"}
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-input/40 border border-border rounded-md px-3 py-2"
            />
            {err && <p className="text-destructive text-sm">{err}</p>}
            <button
              type="submit" disabled={busy}
              className="w-full rounded-md bg-primary text-primary-foreground py-2.5 font-display tracking-widest disabled:opacity-50"
            >
              {busy ? "…" : mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
            </button>
          </form>

          <div className="mt-4 text-center text-xs text-muted-foreground">
            {mode === "signin" ? (
              <>New here? <button className="text-primary underline" onClick={() => setMode("signup")}>Create an account</button></>
            ) : (
              <>Already have one? <button className="text-primary underline" onClick={() => setMode("signin")}>Sign in</button></>
            )}
          </div>
          <div className="mt-4 text-center">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← back to scoreboard</Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}