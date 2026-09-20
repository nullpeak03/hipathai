export default function Loading() {
  return (
    <div className="flex min-h-screen bg-app">
      <div className="hidden md:block w-56 border-r bg-app" />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b bg-card" />
        <main className="p-4 sm:p-6 max-w-4xl mx-auto w-full">
          <div className="h-8 bg-muted rounded w-1/2 animate-pulse" />
          <div className="h-64 bg-card rounded-xl border mt-6 animate-pulse" />
          <div className="h-48 bg-card rounded-xl border mt-6 animate-pulse" />
        </main>
      </div>
    </div>
  )
}
