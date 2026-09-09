import Image from "next/image";

export function Logo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-2">
        <Image src="/icon-192.png" alt="HiPath AI" width={28} height={28} className="rounded-full" />
        <span className="font-display font-bold tracking-tight text-[#E6F4ED]">
          HiPath<span className="text-[#10B981]">_&gt;</span>
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-3">
      <Image src="/icon-192.png" alt="HiPath AI" width={40} height={40} className="rounded-full" />
      <span className="font-display text-xl font-bold tracking-tight text-[#E6F4ED]">
        HI-PATH
      </span>
      <span className="font-display rounded-full bg-gradient-to-br from-[#10B981] to-[#34D399] px-3 py-1 text-sm font-bold text-[#050A08]">
        AI
      </span>
    </span>
  );
}
