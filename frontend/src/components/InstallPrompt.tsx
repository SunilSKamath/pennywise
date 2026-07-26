import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./Button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => window.localStorage.getItem("install_prompt_dismissed") === "true");
  const [installed, setInstalled] = useState(() => window.matchMedia("(display-mode: standalone)").matches);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!promptEvent || dismissed || installed) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-stone-200 bg-white p-3 shadow-soft md:left-auto md:right-6 md:w-80 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-fern text-white">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">Install Pennywise</p>
          <p className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">Open it like a native app from your home screen.</p>
          <Button
            className="mt-3 h-10 w-full"
            onClick={async () => {
              await promptEvent.prompt();
              const choice = await promptEvent.userChoice;
              if (choice.outcome === "dismissed") {
                window.localStorage.setItem("install_prompt_dismissed", "true");
                setDismissed(true);
              }
              setPromptEvent(null);
            }}
          >
            Install
          </Button>
        </div>
        <button
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
          aria-label="Dismiss install prompt"
          onClick={() => {
            window.localStorage.setItem("install_prompt_dismissed", "true");
            setDismissed(true);
          }}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
