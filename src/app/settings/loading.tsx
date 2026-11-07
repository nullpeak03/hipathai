import { AppLoading } from "@/components/layout/app-loading"

export default function Loading() {
  return (
    <AppLoading>
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-64 max-w-full animate-pulse rounded bg-muted" />
      <div className="mt-6 flex gap-6 overflow-hidden border-b border-border pb-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 w-20 shrink-0 animate-pulse rounded bg-muted" />
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    </AppLoading>
  )
}
