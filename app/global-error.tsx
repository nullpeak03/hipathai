"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-[#050A08] text-[#E6F4ED]">
        <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
          <p className="font-mono text-sm text-[#F87171]">&gt; critical error</p>
          <h1 className="font-display mt-2 text-2xl font-bold">App crashed</h1>
          <p className="mt-2 font-mono text-xs text-[#8BA494]">{error.message}</p>
          <button onClick={() => reset()} className="mt-6 rounded-lg bg-[#10B981] px-6 py-2.5 text-sm font-semibold text-[#050A08]">
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
