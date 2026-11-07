"use client"

export function OfflineRetry() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-6 inline-flex min-h-[44px] items-center text-sm font-medium text-primary underline underline-offset-4"
    >
      Retry when online →
    </button>
  )
}
