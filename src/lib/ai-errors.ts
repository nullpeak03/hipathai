// Shared primitives for AI provider clients (Gemini, NIMs).
// One error shape, one retry classifier, one sleep — no duplication.

/** Error carrying the upstream HTTP status (undefined = network/timeout). */
export class ProviderError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = "ProviderError"
    this.status = status
  }
}

/** Retry transient failures (timeout, 429, 5xx). Fatal: 400/401/403/404/410. */
export function isRetriableStatus(status: number | undefined): boolean {
  if (status === undefined) return true
  if (status === 408 || status === 429) return true
  return status >= 500 && status <= 599
}

export function providerStatus(e: unknown): number | undefined {
  return e instanceof ProviderError ? e.status : undefined
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
