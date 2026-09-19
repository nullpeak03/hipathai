import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

/** Extract a readable message from an unknown caught error. */
export function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
