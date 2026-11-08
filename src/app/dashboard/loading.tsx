export default function Loading() {
  return (
    <div className="flex min-h-screen bg-app">
      <div className="hidden md:block w-56 border-r bg-app" />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b bg-card" />
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto" aria-busy="true" aria-label="Loading dashboard">
          <div className="h-[380px] rounded-2xl border bg-card animate-pulse sm:h-[320px]" />

          <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:grid-cols-2 xl:grid-cols-12">
            <div className="h-64 rounded-2xl border bg-card animate-pulse xl:col-span-4" />
            <div className="h-64 rounded-2xl border bg-card animate-pulse xl:col-span-5" />
            <div className="h-64 rounded-2xl border bg-card animate-pulse sm:col-span-2 xl:col-span-3" />
            <div className="h-64 rounded-2xl border bg-card animate-pulse xl:col-span-5" />
            <div className="h-64 rounded-2xl border bg-card animate-pulse xl:col-span-4" />
            <div className="h-64 rounded-2xl border bg-card animate-pulse sm:col-span-2 xl:col-span-3" />
            <div className="h-40 rounded-2xl border bg-card animate-pulse sm:col-span-2 xl:col-span-12" />
          </div>
        </main>
      </div>
    </div>
  )
}
