"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type SubmissionState = "idle" | "submitting" | "sent" | "error"

export function PricingWaitlistForm() {
  const [email, setEmail] = useState("")
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<SubmissionState>("idle")
  const [message, setMessage] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState("submitting")
    setMessage("")

    const formData = new FormData(event.currentTarget)
    try {
      const response = await fetch("/api/pricing/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          consent,
          company: formData.get("company"),
        }),
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        setState("error")
        setMessage(data?.error ?? "We couldn’t submit your request. Please try again.")
        return
      }
      setState("sent")
      setMessage("If this address can be added, you’ll receive a confirmation email shortly.")
    } catch {
      setState("error")
      setMessage("We couldn’t submit your request. Check your connection and try again.")
    }
  }

  if (state === "sent") {
    return (
      <div role="status" aria-live="polite" className="rounded-xl border border-info-border bg-info-bg p-4 text-sm text-info-fg">
        {message}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="pricing-waitlist-email" className="block text-sm font-medium">Email address</label>
      <Input
        id="pricing-waitlist-email"
        type="email"
        name="email"
        autoComplete="email"
        required
        maxLength={254}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="h-11 rounded-xl bg-background focus-visible:ring-primary"
        placeholder="you@example.com"
      />
      <label className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          required
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
        />
        <span>I agree to receive one email when HiPath Pro launches. I can withdraw before then using the link in the confirmation email. No other marketing.</span>
      </label>
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="pricing-waitlist-company">Leave this field empty</label>
        <input id="pricing-waitlist-company" name="company" tabIndex={-1} autoComplete="off" />
      </div>
      <Button
        type="submit"
        disabled={!consent || state === "submitting"}
        className="h-11 w-full rounded-xl px-5 font-semibold disabled:cursor-not-allowed"
      >
        {state === "submitting" ? "Sending…" : "Send me one launch email"}
      </Button>
      {message && <p role="alert" className="text-xs text-danger-fg">{message}</p>}
      <p className="text-center text-[11px] text-muted-foreground">You’ll need to confirm your email before we add you.</p>
    </form>
  )
}

export function WaitlistTokenAction({ token, action }: { token: string; action: "confirm" | "remove" }) {
  const [state, setState] = useState<SubmissionState>("idle")
  const [message, setMessage] = useState("")
  const isConfirm = action === "confirm"

  async function submit() {
    setState("submitting")
    setMessage("")
    try {
      const response = await fetch(`/api/pricing/waitlist/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        setState("error")
        setMessage(data?.error ?? "We couldn’t complete this request. The link may have expired.")
        return
      }
      setState("sent")
      setMessage(isConfirm
        ? "Your email is confirmed. We’ll send one notification when Pro launches."
        : "You’ve been removed from the Pro launch waitlist.")
    } catch {
      setState("error")
      setMessage("We couldn’t complete this request. Please try again.")
    }
  }

  if (state === "sent") {
    return <p role="status" aria-live="polite" className="mt-5 rounded-xl border border-info-border bg-info-bg p-4 text-sm text-info-fg">{message}</p>
  }

  return (
    <div className="mt-5">
      <Button
        type="button"
        onClick={() => void submit()}
        disabled={!token || state === "submitting"}
        className="h-11 rounded-xl px-5 font-semibold"
      >
        {state === "submitting" ? "Please wait…" : isConfirm ? "Confirm email" : "Remove me from the waitlist"}
      </Button>
      {message && <p role="alert" className="mt-3 text-sm text-danger-fg">{message}</p>}
    </div>
  )
}
