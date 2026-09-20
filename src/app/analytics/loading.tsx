export default function Loading() {
  return (
    <div className="flex min-h-screen bg-app">
      <div className="hidden md:block w-56 border-r bg-app" />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b bg-card" />
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <div className="h-8 bg-muted rounded w-40 animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-card rounded-xl border animate-pulse" />
            ))}
          </div>
          <div className="h-48 bg-card rounded-xl border mt-6 animate-pulse" />
        </main>
      </div>
    </div>
  )
}
