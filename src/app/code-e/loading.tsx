import { AppLoading } from "@/components/layout/app-loading"

export default function Loading() {
  return (
    <AppLoading fullHeight mainClassName="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <div className="h-7 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-7 w-20 animate-pulse rounded-md bg-muted" />
        <div className="ml-auto h-8 w-24 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-52 shrink-0 border-r border-border bg-card p-3 lg:block">
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 space-y-2 p-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${90 - (i % 4) * 12}%` }} />
            ))}
          </div>
          <div className="h-36 shrink-0 border-t border-border bg-card p-4">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    </AppLoading>
  )
}
