export * as RemoteLogin from "./login"

import type { RemoteCredentials } from "./credentials"

export type Code = {
  userCode: string
  url: string
  expiresAt: number
}

export type Result =
  | { type: "approved"; credentials: RemoteCredentials.Info }
  | { type: "denied" }
  | { type: "expired" }

// Device authorization (RFC 8628 shaped): show a code, the user approves it in
// the browser, we poll until the relay hands over a long-lived device token.
export async function login(input: {
  relay: string
  name: string
  onCode: (code: Code) => void
  signal?: AbortSignal
}): Promise<Result> {
  const relay = input.relay.replace(/\/$/, "")
  const started = await fetch(`${relay}/device/code`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: input.name }),
    signal: input.signal,
  })
  if (!started.ok) throw new Error(`relay refused to start a login (HTTP ${started.status})`)
  const code = await started.json()
  if (!isCodeResponse(code)) throw new Error("relay sent an unexpected response; is this an mrtoro relay?")
  const expiresAt = Date.now() + code.expires_in * 1000
  input.onCode({ userCode: code.user_code, url: code.verification_uri_complete, expiresAt })

  let interval = Math.max(1, code.interval) * 1000
  while (Date.now() < expiresAt) {
    await Bun.sleep(interval)
    input.signal?.throwIfAborted()
    // A flaky network must not end the login: keep polling until the code expires.
    const response = await fetch(`${relay}/device/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_code: code.device_code }),
      signal: input.signal,
    }).catch((error: unknown) => {
      if (input.signal?.aborted) throw error
      return undefined
    })
    if (!response || response.status >= 500) continue
    const body: unknown = await response.json().catch(() => undefined)
    if (response.ok && isTokenResponse(body))
      return {
        type: "approved",
        credentials: {
          relay,
          token: body.device_token,
          deviceID: body.device_id,
          deviceName: body.device_name,
          email: body.email,
        },
      }
    const error = typeof body === "object" && body !== null && "error" in body ? body.error : undefined
    if (error === "authorization_pending") continue
    if (error === "slow_down") {
      interval += 2_000
      continue
    }
    if (error === "access_denied") return { type: "denied" }
    if (error === "expired_token") return { type: "expired" }
    throw new Error(`unexpected relay response (HTTP ${response.status}${error ? `: ${JSON.stringify(error)}` : ""})`)
  }
  return { type: "expired" }
}

// Best effort: the relay forgets the device so a leaked token stops working.
export async function revoke(credentials: Pick<RemoteCredentials.Info, "relay" | "token">) {
  const response = await fetch(`${credentials.relay}/device/revoke`, {
    method: "POST",
    headers: { authorization: `Bearer ${credentials.token}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined)
  return response?.status === 204 || response?.status === 401
}

export async function whoami(credentials: Pick<RemoteCredentials.Info, "relay" | "token">) {
  const response = await fetch(`${credentials.relay}/device/whoami`, {
    headers: { authorization: `Bearer ${credentials.token}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined)
  if (!response) return { type: "unreachable" as const }
  if (response.status === 401) return { type: "revoked" as const }
  if (!response.ok) return { type: "unreachable" as const }
  return { type: "valid" as const }
}

function isCodeResponse(value: unknown): value is {
  device_code: string
  user_code: string
  verification_uri_complete: string
  expires_in: number
  interval: number
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "device_code" in value &&
    typeof value.device_code === "string" &&
    "user_code" in value &&
    typeof value.user_code === "string" &&
    "verification_uri_complete" in value &&
    typeof value.verification_uri_complete === "string" &&
    "expires_in" in value &&
    typeof value.expires_in === "number" &&
    "interval" in value &&
    typeof value.interval === "number"
  )
}

function isTokenResponse(value: unknown): value is {
  device_token: string
  device_id: string
  device_name: string
  email: string
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "device_token" in value &&
    typeof value.device_token === "string" &&
    "device_id" in value &&
    typeof value.device_id === "string" &&
    "device_name" in value &&
    typeof value.device_name === "string" &&
    "email" in value &&
    typeof value.email === "string"
  )
}
