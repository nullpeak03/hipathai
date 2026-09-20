"use client"
import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export type ToastKind = "success" | "error" | "info"
export type ToastInput = { message: string; title?: string; kind?: ToastKind }

type Toast = ToastInput & { id: number; kind: ToastKind }

const ToastPushContext = createContext<(t: ToastInput) => void>(() => {})

/** Push a toast from any client component. */
export function useToast() {
  return useContext(ToastPushContext)
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((t: ToastInput) => {
    const id = nextId++
    const kind = t.kind ?? "info"
    setToasts((prev) => [...prev.slice(-2), { ...t, id, kind }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id))
    }, 4500)
  }, [])

  return (
    <ToastPushContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[min(92vw,360px)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={cn(
              "rounded-xl border bg-white p-4 shadow-lg text-sm",
              t.kind === "error" && "border-red-200",
              t.kind === "success" && "border-emerald-200",
              t.kind === "info" && "border-zinc-200"
            )}
          >
            {t.title && <div className="font-semibold">{t.title}</div>}
            <div className={t.kind === "error" ? "text-red-700" : "text-zinc-600"}>{t.message}</div>
          </div>
        ))}
      </div>
    </ToastPushContext.Provider>
  )
}
