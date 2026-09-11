"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050A08] px-5 text-center text-[#E6F4ED]">
      <p className="font-mono text-sm text-[#F87171]">&gt; something went wrong</p>
      <h1 className="font-display mt-2 text-2xl font-bold">Unexpected error</h1>
      <p className="mt-2 max-w-md font-mono text-xs text-[#8BA494]">{error.message || "An unexpected error occurred."}</p>
      <button onClick={() => reset()} className="mt-6 rounded-lg bg-[#10B981] px-6 py-2.5 text-sm font-semibold text-[#050A08] hover:bg-[#34D399]">
        Try again
      </button>
    </div>
  );
}
