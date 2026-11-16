# AI failure handling

P2-8 of the 2026-11-13 audit. The last version of this document's subject was
"single vendor, no fallback". This is what actually exists now, in the order it
runs.

## Layers

| Layer | Covers | Code |
| --- | --- | --- |
| Model fallback | one NIM model is slow, overloaded, deprecated, or not provisioned for the account | `resolveNimFallback` + hedge in `chatForFeature` (`src/lib/ai-router.ts`) |
| Key failover | the key is rejected (401/403/402) or rate/quota-limited (429) | `nimApiKeys` + rotation in `callNim` / `callNimStream` (`src/lib/nim.ts`) |
| Deadline | a step cannot exceed the platform's ~60s invocation cap | shared `deadlineAt` through router and client |
| **Missing** | **NVIDIA itself is down, or every key is revoked** | — |

The missing row is deliberate and must stay visible. Two keys on the same
vendor fix the failure the audit actually observed (an account-scoped NVCF
`404 Not found for account`, quota bursts, key rotations). They do not survive
`integrate.api.nvidia.com` returning 5xx for everyone. Closing that needs a
different vendor behind `chatForFeature`, which was scoped and not chosen.

## Key selection

```ts
nimApiKeys() // [NVIDIA_NIM_API_KEY, NVIDIA_NIM_API_KEY_2], trimmed, de-duped
```

- Read live per request, so rotating a key in Vercel needs no rebuild.
- The primary is required in practice; `health` reports `degraded` when it is
  absent even if the secondary works.
- The second key should belong to a **different NVIDIA account**. A second key
  on the same account shares the same quota and is close to useless.

## Rotation rules

Rotation happens inside a single attempt, before retries and before the model
fallback:

- 401 / 402 / 403 / 429 → try the next key immediately. No sleep: a rejected
  key does not heal, and a rate-limited one would otherwise wait up to 60s
  (`Retry-After`) and blow the step budget.
- 5xx, timeouts, 404 "Function not found for account", invalid JSON → **do not**
  rotate. These are model/network/deployment failures; the existing retry and
  the fallback model handle them.
- A rotation is skipped when the shared deadline cannot fit another request, so
  a slow primary plus an expired key still fails with the real 401 instead of a
  misleading timeout.
- Key order only moves forward within one call: primary → secondary. There is
  no rotation back, no unbounded cycling, and at most one extra request.
- `callNimStream` rotates **before** the first byte is yielded, so the tutor
  never shows half an answer from a dead key.

## Operating it

Add the second key in Vercel → Project → Settings → Environment Variables:

```
NVIDIA_NIM_API_KEY_2=nvapi-...
```

Set it for **Production and Preview**. Re-deploy is not required for the app to
pick it up (env is read per request), but a deployment is needed for the value
to exist in that deployment's environment.

## Verifying without breaking production

1. Format-check both keys locally, then probe each:

   ```bash
   npm run check:ai          # primary
   npm run check:ai:2        # secondary (sets AI_PROBE_KEY=2)
   ```

2. Prove failover on a **preview** deployment, never by breaking production:
   - duplicate the deployment, set `NVIDIA_NIM_API_KEY` to a valid-format but
     revoked key and keep the real `NVIDIA_NIM_API_KEY_2`;
   - trigger one lesson or quiz generation;
   - expect the job to succeed and the logs to show
     `key slot 1 failed (HTTP 401) — trying key slot 2`.

3. Rollback is removing `NVIDIA_NIM_API_KEY_2` (or reverting the two files).
   With one key the behaviour is identical to before the change.

## What to check after a failure

Generation errors still surface the last error, so an `NIM_AUTH_FAILED` in job
telemetry now means **both** keys were rejected, not just one. If that happens
while `check:ai` passes, the failure is upstream of the keys.
