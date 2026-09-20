export default function Loading() {
  return (
    <div className="flex min-h-screen bg-app">
      <div className="hidden md:block w-56 border-r bg-app" />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b bg-card" />
        <main className="flex-1 flex flex-col max-w-6xl w-full mx-auto p-4 sm:p-6 gap-4">
          <div className="flex gap-4 flex-1">
            <div className="hidden lg:block w-64 h-96 bg-card rounded-xl border animate-pulse" />
            <div className="flex-1 h-96 bg-card rounded-xl border animate-pulse" />
          </div>
        </main>
      </div>
    </div>
  )
}
