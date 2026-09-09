import Link from "next/link";

export default function Offline() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050A08] px-5 text-center text-[#E6F4ED]">
      <p className="font-mono text-sm text-[#FBBF24]">&gt; offline</p>
      <h1 className="font-display mt-3 text-2xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-sm text-[#8BA494]">
        Cached lessons stay readable. Quiz answers queue on-device and sync when you&apos;re back.
      </p>
      <Link href="/app/dashboard" className="mt-6 rounded-lg bg-[#10B981] px-6 py-2.5 text-sm font-bold text-[#050A08]">
        Back to Dashboard
      </Link>
    </div>
  );
}
