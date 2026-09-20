"use client"
export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app p-8">
      <div className="max-w-md w-full bg-card rounded-2xl border border-border p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-danger-bg border border-danger-border flex items-center justify-center mx-auto mb-4 text-xl">⚠️</div>
        <h2 className="text-lg font-bold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground mt-2 break-all">{error.message || "Client-side exception"}</p>
        <div className="flex gap-3 mt-6 justify-center">
          <button onClick={reset} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">Try again</button>
          <a href="/dashboard" className="px-4 py-2 border rounded-lg text-sm">Go to Dashboard</a>
        </div>
      </div>
    </div>
  )
}
