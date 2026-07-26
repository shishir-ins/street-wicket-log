import { useEffect, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * useAdmin — real Supabase-backed admin gate.
 * A signed-in user is "admin" iff they have a row in public.user_roles with role='admin'.
 * The first person who signs up is auto-assigned admin by a database trigger.
 */
export function useAdmin() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUserId(data.session?.user?.id ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      qc.invalidateQueries({ queryKey: ["admin-role"] });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [qc]);

  const roleQ = useQuery({
    queryKey: ["admin-role", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
  });

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    isAdmin: ready && !!userId && roleQ.data === true,
    isSignedIn: ready && !!userId,
    isLoading: !ready || (!!userId && roleQ.isLoading),
    signOut,
  };
}

export function AdminLockButton() {
  const { isAdmin, isSignedIn, signOut } = useAdmin();
  if (isAdmin) {
    return (
      <button
        onClick={() => { void signOut(); }}
        className="text-[10px] font-display tracking-widest text-primary hover:text-destructive"
      >
        🔓 ADMIN — sign out
      </button>
    );
  }
  if (isSignedIn) {
    return (
      <button
        onClick={() => { void signOut(); }}
        className="text-[10px] font-display tracking-widest text-muted-foreground hover:text-foreground"
      >
        👁 VIEWER — sign out
      </button>
    );
  }
  return (
    <Link
      to="/auth"
      className="text-[10px] font-display tracking-widest text-muted-foreground hover:text-primary"
    >
      🔒 SIGN IN
    </Link>
  );
}