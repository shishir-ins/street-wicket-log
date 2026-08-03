import { useEffect, useState } from "react";
import { Pin } from "lucide-react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * "Pin live match" — installs the app to the home screen. The installed icon
 * launches /live, which jumps straight to whatever match is currently live.
 */
export function PinLiveButton({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<PromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as PromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  return (
    <div className={className}>
      <button
        onClick={async () => {
          if (deferred) {
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
          } else {
            setHelp((v) => !v);
          }
        }}
        className="btn-chalk rounded-full px-4 py-2 text-xs inline-flex items-center gap-2"
      >
        <Pin className="h-3.5 w-3.5" /> PIN LIVE MATCH
      </button>
      {help && (
        <p className="n-label mt-2 max-w-xs leading-relaxed">
          On iPhone: Share → Add to Home Screen. On Android: menu → Install app. The icon opens the live match.
        </p>
      )}
    </div>
  );
}
