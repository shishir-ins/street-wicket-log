import { useEffect, useState, useCallback } from "react";

const KEY = "bellamlabidi.admin";
const PIN = (import.meta.env.VITE_ADMIN_PIN as string | undefined) ?? "1234";

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    try {
      setIsAdmin(localStorage.getItem(KEY) === "1");
    } catch { /* ignore */ }
  }, []);
  const unlock = useCallback((pin: string) => {
    if (pin === PIN) {
      try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
      setIsAdmin(true);
      return true;
    }
    return false;
  }, []);
  const lock = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    setIsAdmin(false);
  }, []);
  return { isAdmin, unlock, lock };
}

export function AdminLockButton() {
  const { isAdmin, unlock, lock } = useAdmin();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  if (isAdmin) {
    return (
      <button onClick={lock} className="text-[10px] font-display tracking-widest text-muted-foreground hover:text-destructive">
        🔓 ADMIN — lock
      </button>
    );
  }
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-[10px] font-display tracking-widest text-muted-foreground hover:text-primary">
        🔒 ADMIN
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="chalk-board p-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display tracking-widest text-lg mb-2">Admin PIN</h3>
            <input
              type="password"
              autoFocus
              value={pin}
              onChange={(e) => { setPin(e.target.value); setErr(""); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (unlock(pin)) { setOpen(false); setPin(""); }
                  else setErr("Wrong PIN");
                }
              }}
              className="w-full bg-input/40 border border-border rounded-md px-3 py-2 mb-2"
              placeholder="Enter PIN"
            />
            {err && <p className="text-destructive text-xs mb-2">{err}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="btn-chalk rounded-md px-3 py-1.5 text-sm">Cancel</button>
              <button
                onClick={() => { if (unlock(pin)) { setOpen(false); setPin(""); } else setErr("Wrong PIN"); }}
                className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-display tracking-wide"
              >Unlock</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}