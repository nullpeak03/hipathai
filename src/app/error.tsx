"use client"
export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 p-8">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl border dark:border-zinc-800 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center mx-auto mb-4 text-xl">⚠️</div>
        <h2 className="text-lg font-bold">Something went wrong</h2>
        <p className="text-sm text-zinc-500 mt-2 break-all">{error.message || "Client-side exception"}</p>
        <div className="flex gap-3 mt-6 justify-center">
          <button onClick={reset} className="px-4 py-2 bg-[#6C5BFF] text-white rounded-lg text-sm">Try again</button>
          <a href="/dashboard" className="px-4 py-2 border rounded-lg text-sm">Go to Dashboard</a>
        </div>
      </div>
    </div>
  )
}
