export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col bg-app">
      <div className="sticky top-0 z-10 h-14 border-b border-border bg-card" />
      <div className="relative mx-auto mt-2 w-full max-w-2xl p-6">
        <div className="h-2 animate-pulse rounded-full bg-muted" />
        <div className="mt-8 min-h-[460px] rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="h-7 w-56 max-w-full animate-pulse rounded bg-muted" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
          <div className="mt-8 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
          <div className="mt-8 h-11 w-32 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  )
}
