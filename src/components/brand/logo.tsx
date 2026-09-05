import Image from "next/image"
import Link from "next/link"

interface LogoProps {
  href?: string
  compact?: boolean
  className?: string
}

export function Logo({ href, compact = false, className = "" }: LogoProps) {
  const content = (
    <>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl ring-1 ring-lime-400/30 shadow-[0_0_24px_rgba(111,220,0,0.18)]">
        <Image
          src="/hipath-ai-icon.png"
          alt=""
          width={72}
          height={72}
          className="h-full w-full object-cover"
          priority
        />
      </span>
      {!compact && (
        <span className="font-semibold tracking-tight">
          HiPath <span className="text-lime-500">AI</span>
        </span>
      )}
    </>
  )

  if (!href) return <span className={`inline-flex items-center gap-2 ${className}`}>{content}</span>

  return (
    <Link href={href} className={`inline-flex items-center gap-2 ${className}`}>
      {content}
    </Link>
  )
}
