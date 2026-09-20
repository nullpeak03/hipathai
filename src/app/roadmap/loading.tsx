export default function Loading() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden md:block w-56 border-r bg-gray-50/50" />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b bg-white" />
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mt-2 animate-pulse" />
          <div className="grid grid-cols-3 gap-4 mt-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-xl border animate-pulse" />
            ))}
          </div>
          <div className="space-y-4 mt-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-white rounded-xl border animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
