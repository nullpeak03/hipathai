"use client";

import { useEffect, useState } from "react";

export function InstallButton() {
  const [deferred, setDeferred] = useState<Event | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setDone(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (done) return <p className="font-mono text-xs text-[#34D399]">installed ✓ — offline lessons enabled</p>;
  if (!deferred) return <p className="font-mono text-xs text-[#8BA494]">PWA install appears here when the browser offers it</p>;
  return (
    <button
      onClick={async () => {
        const d = deferred as unknown as { prompt: () => void; userChoice: Promise<unknown> };
        d.prompt();
        await d.userChoice;
        setDeferred(null);
      }}
      className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-bold text-[#050A08] hover:bg-[#34D399]"
    >
      Install HiPath App
    </button>
  );
}
