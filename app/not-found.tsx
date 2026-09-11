import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050A08] px-5 text-center text-[#E6F4ED]">
      <p className="font-mono text-sm text-[#F87171]">&gt; 404 — path not found</p>
      <h1 className="font-display mt-2 text-2xl font-bold">This path doesn&apos;t exist</h1>
      <p className="mt-2 max-w-md text-sm text-[#8BA494]">The page you&apos;re looking for was not found. Check the URL or return home.</p>
      <Link href="/" className="mt-6 rounded-lg bg-[#10B981] px-6 py-2.5 text-sm font-semibold text-[#050A08] hover:bg-[#34D399]">
        Back to home
      </Link>
    </div>
  );
}
