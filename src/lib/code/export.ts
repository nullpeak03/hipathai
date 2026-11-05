// Client-side download helper. ZIP export (later phase) will reuse the same
// safety checks before handing bytes to the browser.

export function fileNameFromPath(path: string): string {
  const name = path.split("/").pop()?.trim()
  return name || "main.txt"
}

export function downloadTextFile(fileName: string, content: string): void {
  if (typeof document === "undefined") return
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = fileName
    anchor.rel = "noopener"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    // Give the browser a tick to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/** A short, filesystem-safe stem for project exports. */
export function safeFileStem(input: string): string {
  const stem = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return stem || "hipath-project"
}
