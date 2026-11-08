export function AnalyticsSkeleton() {
  return (
    <div className="mt-4 space-y-4 sm:mt-5" aria-busy="true" aria-label="Loading analytics">
      <div className="h-[212px] animate-pulse rounded-2xl border border-border bg-card" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-[104px] animate-pulse rounded-2xl border border-border bg-card"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12">
        <div className="h-[300px] animate-pulse rounded-2xl border border-border bg-card sm:col-span-2 xl:col-span-7" />
        <div className="h-[300px] animate-pulse rounded-2xl border border-border bg-card sm:col-span-2 xl:col-span-5" />
        <div className="h-[280px] animate-pulse rounded-2xl border border-border bg-card sm:col-span-2 xl:col-span-5" />
        <div className="h-[280px] animate-pulse rounded-2xl border border-border bg-card sm:col-span-2 xl:col-span-4" />
        <div className="h-[280px] animate-pulse rounded-2xl border border-border bg-card sm:col-span-2 xl:col-span-3" />
        <div className="h-[240px] animate-pulse rounded-2xl border border-border bg-card sm:col-span-2 xl:col-span-12" />
      </div>
    </div>
  )
}
