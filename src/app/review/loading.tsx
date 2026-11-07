import { AppLoading } from "@/components/layout/app-loading"

export default function Loading() {
  return (
    <AppLoading mainClassName="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <div className="h-8 w-64 max-w-full animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
      <div className="mt-6 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <div className="h-5 w-48 max-w-full animate-pulse rounded bg-muted" />
            <div className="mt-3 h-4 w-full animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="mt-4 flex gap-2">
              <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
              <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </AppLoading>
  )
}
