/**
 * Captures `beforeinstallprompt` the instant it fires — it is a one-shot event
 * that often lands BEFORE React hydrates (manifest + worker are cached from
 * prior visits), so a `useEffect` listener alone always misses it. Stashed on
 * window for `useInstallPrompt()` to pick up on mount.
 *
 * Lives here rather than inline in the layout so its sha256 can be pinned in
 * `src/lib/csp.ts` (strict pages allow this exact script by hash) and asserted
 * in `csp.test.ts`.
 */
export const INSTALL_CAPTURE_SCRIPT = `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__hipathInstallPrompt=e;if(window.console&&console.info)console.info('[pwa] install prompt captured');});window.addEventListener('appinstalled',function(){window.__hipathInstallPrompt=null;if(window.console&&console.info)console.info('[pwa] app installed');});`
