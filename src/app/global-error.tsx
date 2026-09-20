"use client"
export default function GlobalError({ error, reset }: { error: Error, reset: () => void }) {
  return (
    <html lang="en"><body className="min-h-screen flex items-center justify-center bg-app p-8">
      <div className="max-w-md w-full bg-card rounded-2xl border border-border p-8 text-center">
        <h2 className="text-lg font-bold">Application error</h2>
        <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        <button onClick={reset} className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg">Reload</button>
      </div>
    </body></html>
  )
}
