export default function Loading() {
  return (
    <div className="flex h-dvh overflow-hidden bg-app">
      <div className="hidden w-56 border-r border-border bg-app md:block" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-14 shrink-0 border-b border-border bg-card" />
        <div className="flex min-h-0 flex-1">
          <div className="flex-1 space-y-4 p-6">
            <div className="mx-auto h-8 w-1/3 animate-pulse rounded bg-muted" />
            <div className="mx-auto h-24 w-full max-w-[700px] animate-pulse rounded-xl bg-card" />
          </div>
          <div className="hidden w-[340px] shrink-0 animate-pulse border-l border-border bg-card xl:block" />
        </div>
      </div>
    </div>
  )
}
