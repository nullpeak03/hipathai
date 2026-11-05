import Link from "next/link"
import { ArrowLeft, BookOpen, Compass, Map } from "lucide-react"

const links = [
  { href: "/roadmaps", label: "Roadmap library", description: "Browse week-by-week syllabi", icon: Map },
  { href: "/guides", label: "Guides", description: "Practical learning write-ups", icon: BookOpen },
  { href: "/pricing", label: "Pricing", description: "What is free and what is planned", icon: Compass },
]

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between border-b px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">H</span>
          <span className="font-bold">HiPath AI</span>
        </Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Back to home</Link>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-6 py-16">
        <p className="t-caption font-mono">404 — PATH NOT FOUND</p>
        <h1 className="t-display mt-2">This route isn&apos;t on the map.</h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          The page may have moved, or the link may be out of date. Pick up from one of these instead.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {links.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:shadow-sm"
            >
              <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
              <div className="mt-2 text-sm font-semibold">{label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
            </Link>
          ))}
        </div>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-10 w-fit items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Go home
        </Link>
      </main>
    </div>
  )
}
