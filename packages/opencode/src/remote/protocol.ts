export * as RemoteProtocol from "./protocol"

// Wire protocol between `mrtoro remote-control` (agent) and the relay.
// This file is copied verbatim into the relay repo; keep it dependency-free.

export const VERSION = 1

// Agent pings every HEARTBEAT ms; either side treats a connection as dead when
// nothing arrived for DEAD_AFTER ms. Cloudflare drops idle sockets after ~100s.
export const HEARTBEAT = 10_000
export const DEAD_AFTER = 25_000
export const HELLO_TIMEOUT = 10_000
export const CHUNK_SIZE = 64 * 1024
export const MAX_REQUEST_BODY = 32 * 1024 * 1024

export type Header = [string, string]

export type FatalCode = "unauthorized" | "protocol" | "replaced" | "invalid"

export type AgentMessage =
  | {
      type: "hello"
      protocol: number
      token: string
      envID: string
      instanceID: string
      name: string
      directory: string
      version: string
    }
  | { type: "res"; id: number; status: number; headers: Header[] }
  | { type: "res-end"; id: number }
  | { type: "res-error"; id: number; message: string }
  | { type: "ping"; t: number }
  | { type: "pong"; t: number }
  | { type: "bye" }

export type RelayMessage =
  | { type: "welcome"; envID: string }
  | { type: "fatal"; code: FatalCode; message: string }
  | { type: "req"; id: number; method: string; path: string; headers: Header[]; body: boolean }
  | { type: "req-end"; id: number }
  | { type: "cancel"; id: number }
  | { type: "ping"; t: number }
  | { type: "pong"; t: number }
  | { type: "goaway" }

export const BodyKind = {
  request: 1,
  response: 2,
} as const

export function encodeBody(kind: number, id: number, payload: Uint8Array) {
  const frame = new Uint8Array(5 + payload.byteLength)
  const view = new DataView(frame.buffer)
  view.setUint8(0, kind)
  view.setUint32(1, id)
  frame.set(payload, 5)
  return frame
}

export function decodeBody(frame: Uint8Array) {
  if (frame.byteLength < 5) return undefined
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength)
  return { kind: view.getUint8(0), id: view.getUint32(1), payload: frame.subarray(5) }
}

export function* chunks(data: Uint8Array) {
  for (let offset = 0; offset < data.byteLength; offset += CHUNK_SIZE) {
    yield data.subarray(offset, offset + CHUNK_SIZE)
  }
}

export function parseAgentMessage(text: string) {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- only the tag is checked here; the relay validates the fields it acts on (hello, res).
  return parse(text) as AgentMessage | undefined
}

export function parseRelayMessage(text: string) {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- only the tag is checked here; the relay is authenticated and malformed requests fail inside dispatch.
  return parse(text) as RelayMessage | undefined
}

function parse(text: string) {
  const value: unknown = (() => {
    try {
      return JSON.parse(text)
    } catch {
      return undefined
    }
  })()
  if (typeof value !== "object" || value === null || !("type" in value) || typeof value.type !== "string")
    return undefined
  return value
}

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "host",
])

export function forwardable(name: string) {
  return !HOP_BY_HOP.has(name.toLowerCase())
}

export const ENV_ID = /^env_[A-Za-z0-9]{16,64}$/

export function createEnvID() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  // 62 * 4 = 248, so `byte % 62` is unbiased after rejecting bytes >= 248.
  const bytes = Array.from(crypto.getRandomValues(new Uint8Array(64))).filter((byte) => byte < 248)
  return "env_" + bytes
    .slice(0, 24)
    .map((byte) => alphabet[byte % 62])
    .join("")
}
