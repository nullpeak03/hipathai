"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

/** Payload of the install prompt event (not in TS DOM libs — typed locally). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/**
 * Install entry point: Chrome/Edge fire beforeinstallprompt (we capture and
 * trigger on click); iOS Safari has no prompt so we show manual steps;
 * installed apps show confirmation.
 */
export function InstallAppCard() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    setInstalled(standalone)
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent))
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const install = async () => {
    if (!deferred) return
    setBusy(true)
    try {
      await deferred.prompt()
      await deferred.userChoice
    } finally {
      setDeferred(null)
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-sm font-medium">Install HiPath AI</div>
      <p className="text-xs text-muted-foreground mt-1">
        Add it to your home screen for fullscreen learning and offline access to cached lessons.
      </p>
      <div className="mt-3">
        {installed ? (
          <p className="text-sm text-emerald-600">Installed ✓ — you&apos;re running the app.</p>
        ) : deferred ? (
          <Button size="sm" onClick={() => void install()} disabled={busy}>
            {busy ? "Installing…" : "Install app →"}
          </Button>
        ) : isIOS ? (
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Tap the Share button in Safari</li>
            <li>Choose &ldquo;Add to Home Screen&rdquo;</li>
            <li>Tap Add — find HiPath AI on your home screen</li>
          </ol>
        ) : (
          <p className="text-xs text-muted-foreground">
            Installable from Chrome or Edge on Android/desktop via the address-bar install icon.
          </p>
        )}
      </div>
    </div>
  )
}
