"use client"

import { useEffect, useRef, useState } from "react"
import { useClerk, useSession, useUser } from "@clerk/nextjs"
import type {
  EmailAddressResource,
  SessionWithActivitiesResource,
  UserResource,
} from "@clerk/shared/types"
import {
  AtSign,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Monitor,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { IconBadge } from "@/components/ui/icon-badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { formatLastActive } from "@/lib/settings-prefs"
import { cn } from "@/lib/utils"

function clerkErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "errors" in error) {
    const errors = (error as { errors?: { message?: string; longMessage?: string }[] }).errors
    const first = errors?.[0]
    if (first?.longMessage || first?.message) return first.longMessage || first.message || fallback
  }
  return error instanceof Error && error.message ? error.message : fallback
}

function AccountCard({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <IconBadge icon={icon} size="sm" tone="muted" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  )
}

function InlineError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-xs text-danger-fg">
      {message}
    </p>
  )
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        verified ? "bg-ok-bg text-ok-fg" : "bg-warn-bg text-warn-fg"
      )}
    >
      {verified ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : null}
      {verified ? "Verified" : "Unverified"}
    </span>
  )
}

function IdentityCard({ user }: { user: UserResource }) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [firstName, setFirstName] = useState(user.firstName ?? "")
  const [lastName, setLastName] = useState(user.lastName ?? "")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFirstName(user.firstName ?? "")
    setLastName(user.lastName ?? "")
  }, [user.id, user.firstName, user.lastName])

  const dirty = firstName.trim() !== (user.firstName ?? "") || lastName.trim() !== (user.lastName ?? "")

  const saveName = async () => {
    if (!firstName.trim() && !lastName.trim()) {
      setError("Enter at least a first or last name.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await user.update({
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
      })
      toast({ title: "Profile updated", message: "Your name is saved.", kind: "success" })
    } catch (caught) {
      setError(clerkErrorMessage(caught, "Could not update your name. Check that name changes are enabled for your account."))
    } finally {
      setSaving(false)
    }
  }

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Choose a PNG, JPG, or WebP image.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Keep the image under 5 MB.")
      return
    }
    setUploading(true)
    setError(null)
    try {
      await user.setProfileImage({ file })
      await user.reload()
      toast({ title: "Photo updated", message: "Your new avatar is live.", kind: "success" })
    } catch (caught) {
      setError(clerkErrorMessage(caught, "Could not update your photo. Check that image uploads are enabled."))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <AccountCard
      icon={UserRound}
      title="Name & photo"
      description="How you appear across HiPath. Managed by your sign-in account."
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {user.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.imageUrl}
            alt={user.fullName ? `${user.fullName} avatar` : "Profile avatar"}
            className="h-16 w-16 shrink-0 rounded-2xl border border-border object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
            {(user.firstName?.[0] ?? user.fullName?.[0] ?? "H").toUpperCase()}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => void uploadAvatar(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
            {uploading ? "Uploading…" : "Change photo"}
          </Button>
          <span className="text-[11px] text-muted-foreground">PNG, JPG, or WebP up to 5 MB.</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field id="settings-first-name" label="First name">
          <Input
            id="settings-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoComplete="given-name"
            maxLength={64}
          />
        </Field>
        <Field id="settings-last-name" label="Last name">
          <Input
            id="settings-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            autoComplete="family-name"
            maxLength={64}
          />
        </Field>
      </div>

      <div className="mt-3 space-y-3">
        <InlineError message={error} />
        <Button type="button" size="sm" onClick={() => void saveName()} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save name"}
        </Button>
      </div>
    </AccountCard>
  )
}

function EmailCard({ user }: { user: UserResource }) {
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [pending, setPending] = useState<EmailAddressResource | null>(null)
  const [pendingIsNew, setPendingIsNew] = useState(false)
  const [promoteOnVerify, setPromoteOnVerify] = useState(true)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<EmailAddressResource | null>(null)

  const emails = user.emailAddresses
  const primaryId = user.primaryEmailAddressId

  const startAdd = () => {
    setAdding(true)
    setPending(null)
    setPendingIsNew(false)
    setPromoteOnVerify(true)
    setNewEmail("")
    setCode("")
    setError(null)
  }

  const sendCode = async () => {
    const value = newEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email address.")
      return
    }
    setBusy(true)
    setError(null)
    let created: EmailAddressResource | null = null
    try {
      created = await user.createEmailAddress({ email: value })
      await created.prepareVerification({ strategy: "email_code" })
      setPending(created)
      setPendingIsNew(true)
      setPromoteOnVerify(true)
      setCode("")
      toast({ title: "Code sent", message: `Check ${value} for a 6-digit code.`, kind: "info" })
    } catch (caught) {
      if (created) {
        try {
          await created.destroy()
          await user.reload()
        } catch {
          // The unverified address will remain harmless if cleanup fails.
        }
      }
      setError(clerkErrorMessage(caught, "Could not add that email. Check that email changes are enabled."))
    } finally {
      setBusy(false)
    }
  }

  const resendCode = async () => {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      await pending.prepareVerification({ strategy: "email_code" })
      toast({ title: "Code resent", message: "Check your inbox for a new code.", kind: "info" })
    } catch (caught) {
      setError(clerkErrorMessage(caught, "Could not resend the code. Try again."))
    } finally {
      setBusy(false)
    }
  }

  const verifyCode = async () => {
    if (!pending) return
    if (code.trim().length < 4) {
      setError("Enter the code from your email.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const verified = await pending.attemptVerification({ code: code.trim() })
      const wasPrimary = user.primaryEmailAddressId === verified.id
      await user.reload()
      if (promoteOnVerify) {
        await user.update({ primaryEmailAddressId: verified.id })
        await user.reload()
      }
      toast({
        title: "Email verified",
        message: promoteOnVerify
          ? `${verified.emailAddress} is now your primary email.`
          : wasPrimary
            ? `${verified.emailAddress} is verified and remains your primary email.`
            : `${verified.emailAddress} is verified. You can make it primary any time.`,
        kind: "success",
      })
      setPending(null)
      setPendingIsNew(false)
      setAdding(false)
      setNewEmail("")
      setCode("")
    } catch (caught) {
      setError(clerkErrorMessage(caught, "That code did not work. Check it and try again."))
    } finally {
      setBusy(false)
    }
  }

  const startVerifyExisting = async (email: EmailAddressResource) => {
    setBusy(true)
    setError(null)
    try {
      await email.prepareVerification({ strategy: "email_code" })
      setPending(email)
      setPendingIsNew(false)
      setPromoteOnVerify(false)
      setAdding(true)
      setNewEmail(email.emailAddress)
      setCode("")
      toast({ title: "Code sent", message: `Check ${email.emailAddress} for a 6-digit code.`, kind: "info" })
    } catch (caught) {
      setError(clerkErrorMessage(caught, "Could not send a verification code. Try again."))
    } finally {
      setBusy(false)
    }
  }

  const cancelPending = async () => {
    if (pending && pendingIsNew) {
      setBusy(true)
      try {
        await pending.destroy()
        await user.reload()
      } catch {
        // An abandoned unverified address is harmless; the list will refresh later.
      } finally {
        setBusy(false)
      }
    }
    setPending(null)
    setPendingIsNew(false)
    setAdding(false)
    setNewEmail("")
    setCode("")
    setError(null)
  }

  const makePrimary = async (email: EmailAddressResource) => {
    setBusy(true)
    setError(null)
    try {
      await user.update({ primaryEmailAddressId: email.id })
      await user.reload()
      toast({ title: "Primary email updated", message: email.emailAddress, kind: "success" })
    } catch (caught) {
      setError(clerkErrorMessage(caught, "Could not make that email primary."))
    } finally {
      setBusy(false)
    }
  }

  const removeEmail = async () => {
    if (!removeTarget) return
    setBusy(true)
    setError(null)
    try {
      await removeTarget.destroy()
      await user.reload()
      toast({ title: "Email removed", message: removeTarget.emailAddress, kind: "success" })
      setRemoveTarget(null)
    } catch (caught) {
      setError(clerkErrorMessage(caught, "Could not remove that email."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AccountCard
      icon={Mail}
      title="Email addresses"
      description="Sign-in email and recovery address."
      action={
        !adding && !pending ? (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={startAdd}>
            <Plus className="h-4 w-4" aria-hidden />
            Add email
          </Button>
        ) : null
      }
    >
      <ul className="space-y-2">
        {emails.map((email) => {
          const isPrimary = email.id === primaryId
          const verified = email.verification.status === "verified"
          return (
            <li
              key={email.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-app/50 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{email.emailAddress}</span>
                  {isPrimary ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Primary
                    </span>
                  ) : null}
                  <VerifiedBadge verified={verified} />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {isPrimary ? "Used for sign-in and account emails." : "Backup address on your account."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!verified ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void startVerifyExisting(email)}
                  >
                    Verify
                  </Button>
                ) : null}
                {!isPrimary && verified ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void makePrimary(email)}
                  >
                    Make primary
                  </Button>
                ) : null}
                {!isPrimary ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-danger-fg"
                    disabled={busy}
                    onClick={() => setRemoveTarget(email)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Remove
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      {adding ? (
        <div className="mt-4 rounded-xl border border-border bg-app/40 p-3">
          {pending ? (
            <div className="space-y-3">
              <p className="text-sm">
                Enter the 6-digit code sent to <span className="font-medium">{pending.emailAddress}</span>.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="w-full sm:max-w-[180px]">
                  <Field id="settings-email-code" label="Verification code">
                    <Input
                      id="settings-email-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                    />
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => void verifyCode()} disabled={busy}>
                    {busy ? "Verifying…" : "Verify"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void resendCode()} disabled={busy}>
                    Resend
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void cancelPending()}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                void sendCode()
              }}
            >
              <Field id="settings-new-email" label="New email address" hint="We will send a 6-digit code to confirm it.">
                <Input
                  id="settings-new-email"
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy}>
                  {busy ? "Sending…" : "Send code"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void cancelPending()}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : null}

      <div className="mt-3">
        <InlineError message={error} />
      </div>

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove this email?"
        description={`${removeTarget?.emailAddress ?? "This address"} will stop being a backup address on your account.`}
        confirmLabel="Remove email"
        danger
        busy={busy}
        onConfirm={() => void removeEmail()}
        onClose={() => {
          if (!busy) setRemoveTarget(null)
        }}
      />
    </AccountCard>
  )
}

function PasswordCard({ user }: { user: UserResource }) {
  const toast = useToast()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [signOutOthers, setSignOutOthers] = useState(true)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user.passwordEnabled) {
    return (
      <AccountCard icon={KeyRound} title="Password" description="Password sign-in is managed elsewhere.">
        <div className="rounded-xl border border-border bg-app/50 p-3 text-sm text-muted-foreground">
          This account does not use a password. You sign in with a connected provider or another method.
        </div>
      </AccountCard>
    )
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (next.length < 8) {
      setError("Use at least 8 characters for your new password.")
      return
    }
    if (next !== confirm) {
      setError("The new passwords do not match.")
      return
    }
    if (next === current) {
      setError("Choose a password different from your current one.")
      return
    }
    setBusy(true)
    try {
      await user.updatePassword({
        currentPassword: current,
        newPassword: next,
        signOutOfOtherSessions: signOutOthers,
      })
      setCurrent("")
      setNext("")
      setConfirm("")
      toast({
        title: "Password updated",
        message: signOutOthers ? "Other sessions were signed out." : "Use your new password next time you sign in.",
        kind: "success",
      })
    } catch (caught) {
      setError(clerkErrorMessage(caught, "Could not update your password. Check your current password and try again."))
    } finally {
      setBusy(false)
    }
  }

  const inputType = show ? "text" : "password"

  return (
    <AccountCard icon={KeyRound} title="Password" description="Update the password used to sign in.">
      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        <Field id="settings-current-password" label="Current password">
          <Input
            id="settings-current-password"
            type={inputType}
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="settings-new-password" label="New password" hint="At least 8 characters.">
            <Input
              id="settings-new-password"
              type={inputType}
              value={next}
              onChange={(event) => setNext(event.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field id="settings-confirm-password" label="Confirm new password">
            <Input
              id="settings-confirm-password"
              type={inputType}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={signOutOthers}
            onChange={(event) => setSignOutOthers(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            Sign out other sessions
            <span className="block text-[11px] text-muted-foreground">Recommended after changing your password.</span>
          </span>
        </label>
        <InlineError message={error} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={busy || !current || !next || !confirm}>
            {busy ? "Updating…" : "Update password"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShow((value) => !value)} className="gap-1.5">
            {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            {show ? "Hide" : "Show"}
          </Button>
        </div>
      </form>
    </AccountCard>
  )
}

function sessionLabel(session: SessionWithActivitiesResource): string {
  const activity = session.latestActivity
  if (!activity) return "Unknown device"
  const browser = [activity.browserName, activity.browserVersion].filter(Boolean).join(" ")
  return browser || (activity.isMobile ? "Mobile browser" : "Web browser")
}

function sessionLocation(session: SessionWithActivitiesResource): string {
  const activity = session.latestActivity
  if (!activity) return "Unknown location"
  const place = [activity.city, activity.country].filter(Boolean).join(", ")
  return place || activity.ipAddress || "Unknown location"
}

function SessionsCard({ user }: { user: UserResource }) {
  const toast = useToast()
  const { session: currentSession } = useSession()
  const { signOut } = useClerk()
  const [sessions, setSessions] = useState<SessionWithActivitiesResource[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyAll, setBusyAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOthers, setConfirmOthers] = useState(false)
  const [confirmCurrent, setConfirmCurrent] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void user
      .getSessions()
      .then((items) => {
        if (!cancelled) setSessions(items)
      })
      .catch((caught) => {
        if (!cancelled) setError(clerkErrorMessage(caught, "Could not load your sessions."))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const others = currentSession?.id
    ? sessions.filter((session) => session.id !== currentSession.id)
    : []

  const revokeOne = async (session: SessionWithActivitiesResource) => {
    setBusyId(session.id)
    setError(null)
    try {
      await session.revoke()
      setSessions((prev) => prev.filter((item) => item.id !== session.id))
      toast({ title: "Session signed out", message: sessionLabel(session), kind: "success" })
    } catch (caught) {
      setError(clerkErrorMessage(caught, "Could not sign out that session."))
    } finally {
      setBusyId(null)
    }
  }

  const revokeOthers = async () => {
    setBusyAll(true)
    setError(null)
    try {
      const results = await Promise.allSettled(others.map((session) => session.revoke()))
      const revoked = new Set(
        others.filter((_, index) => results[index]?.status === "fulfilled").map((session) => session.id)
      )
      setSessions((prev) => prev.filter((session) => !revoked.has(session.id)))
      const failed = others.length - revoked.size
      if (failed > 0) {
        setError(`Signed out ${revoked.size} session${revoked.size === 1 ? "" : "s"}; ${failed} could not be signed out.`)
      } else {
        toast({ title: "Other sessions signed out", message: "Only this device stays signed in.", kind: "success" })
      }
      setConfirmOthers(false)
    } catch (caught) {
      setError(clerkErrorMessage(caught, "Could not sign out the other sessions."))
    } finally {
      setBusyAll(false)
    }
  }

  const signOutCurrent = async () => {
    setBusyAll(true)
    try {
      await signOut(() => {
        window.location.href = "/"
      })
    } catch {
      window.location.href = "/"
    } finally {
      setBusyAll(false)
      setConfirmCurrent(false)
    }
  }

  return (
    <AccountCard
      icon={ShieldCheck}
      title="Sessions & security"
      description="Devices currently signed in to your account."
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => void user.getSessions().then(setSessions).catch(() => {})}
          disabled={loading}
          aria-label="Refresh sessions"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          Refresh
        </Button>
      }
    >
      {loading ? (
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-[72px] animate-pulse rounded-xl border border-border bg-muted/60" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <p className="rounded-xl border border-border bg-app/50 p-3 text-sm text-muted-foreground">
          No active sessions were returned. Try refreshing.
        </p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => {
            const isCurrent = session.id === currentSession?.id
            const Icon = session.latestActivity?.isMobile ? Smartphone : Monitor
            return (
              <li
                key={session.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-app/50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <IconBadge icon={Icon} size="sm" tone={isCurrent ? "ok" : "muted"} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{sessionLabel(session)}</span>
                      {isCurrent ? (
                        <span className="rounded-full bg-ok-bg px-2 py-0.5 text-[10px] font-medium text-ok-fg">
                          This device
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {sessionLocation(session)} · {formatLastActive(session.lastActiveAt)}
                    </p>
                  </div>
                </div>
                {isCurrent ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setConfirmCurrent(true)}
                    disabled={busyAll}
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden />
                    Sign out
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-danger-fg"
                    onClick={() => void revokeOne(session)}
                    disabled={busyId === session.id || busyAll}
                  >
                    {busyId === session.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <LogOut className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Sign out
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-muted-foreground">
          Revoking a session signs that device out immediately.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setConfirmOthers(true)}
          disabled={others.length === 0 || busyAll}
        >
          Sign out other sessions
        </Button>
      </div>

      <div className="mt-3">
        <InlineError message={error} />
      </div>

      <ConfirmDialog
        open={confirmOthers}
        title="Sign out other sessions?"
        description="Every device except this one will need to sign in again."
        confirmLabel="Sign out others"
        busy={busyAll}
        onConfirm={() => void revokeOthers()}
        onClose={() => {
          if (!busyAll) setConfirmOthers(false)
        }}
      />
      <ConfirmDialog
        open={confirmCurrent}
        title="Sign out of this device?"
        description="You will need to sign in again to return to HiPath."
        confirmLabel="Sign out"
        busy={busyAll}
        onConfirm={() => void signOutCurrent()}
        onClose={() => {
          if (!busyAll) setConfirmCurrent(false)
        }}
      />
    </AccountCard>
  )
}

export function AccountSecurity() {
  const { user, isLoaded } = useUser()

  if (!isLoaded) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading account details">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-2xl border border-border bg-muted/50" />
        ))}
      </div>
    )
  }

  if (!user) {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">Sign in to manage your account details.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-info-border bg-info-bg px-3 py-2 text-[11px] text-info-fg">
        <AtSign className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <p>
          These details live in your secure sign-in account. Changes here apply everywhere you use HiPath.
        </p>
      </div>
      <IdentityCard user={user} />
      <EmailCard user={user} />
      <PasswordCard user={user} />
      <SessionsCard user={user} />
    </div>
  )
}
