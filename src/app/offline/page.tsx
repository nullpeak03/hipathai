import Link from "next/link"

export const metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
}

/** Served by the service worker when a navigation has no connection. */
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
        H
      </div>
      <h1 className="text-2xl font-bold mt-6">You&apos;re offline</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
        HiPath AI needs a connection to generate and sync. Your cached roadmap
        and progress are safe — reconnect and everything resumes.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 text-sm font-medium text-primary underline underline-offset-4"
      >
        Retry when online →
      </Link>
    </div>
  )
}
