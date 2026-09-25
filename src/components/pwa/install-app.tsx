"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

/** Payload of the install prompt event (not in TS DOM libs — typed locally). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

type InstallState = {
  /** Browser fired beforeinstallprompt and we captured it. */
  canInstall: boolean
  installed: boolean
  isIOS: boolean
  busy: boolean
  install: () => Promise<void>
}

/** Shared install state: prompt capture, installed detection, iOS sniffing. */
export function useInstallPrompt(): InstallState {
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

  return { canInstall: deferred !== null, installed, isIOS, busy, install }
}

/**
 * Compact install button for hero/CTA spots. Renders nothing unless the
 * browser offers installation (or the app is already installed) — keeps
 * marketing surfaces clean; the full guide lives in Settings → App.
 */
export function InstallButton({
  variant = "outline",
  size = "sm",
}: {
  variant?: "outline" | "secondary" | "default"
  size?: "sm" | "lg" | "default"
}) {
  const { canInstall, installed, install, busy } = useInstallPrompt()
  if (installed || !canInstall) return null
  return (
    <Button variant={variant} size={size} onClick={() => void install()} disabled={busy} className="gap-2">
      <Download className="w-4 h-4" />
      {busy ? "Installing…" : "Install app"}
    </Button>
  )
}

/**
 * Install entry point: Chrome/Edge fire beforeinstallprompt (we capture and
 * trigger on click); iOS Safari has no prompt so we show manual steps;
 * installed apps show confirmation.
 */
export function InstallAppCard() {
  const { canInstall, installed, isIOS, busy, install } = useInstallPrompt()

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-sm font-medium">Install HiPath AI</div>
      <p className="text-xs text-muted-foreground mt-1">
        Add it to your home screen for fullscreen learning and offline access to cached lessons.
      </p>
      <div className="mt-3">
        {installed ? (
          <p className="text-sm text-emerald-600">Installed ✓ — you&apos;re running the app.</p>
        ) : canInstall ? (
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
