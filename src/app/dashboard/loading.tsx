export default function Loading() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden md:block w-56 border-r bg-gray-50/50" />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b bg-white" />
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <div className="h-7 bg-gray-200 rounded w-40 animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-xl border animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-white rounded-xl border mt-6 animate-pulse" />
        </main>
      </div>
    </div>
  )
}
