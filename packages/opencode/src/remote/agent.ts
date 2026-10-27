export * as RemoteAgent from "./agent"

import os from "os"
import { RemoteProtocol } from "./protocol"

export type Status =
  | { type: "connecting"; attempt: number }
  | { type: "ready" }
  | { type: "waiting"; attempt: number; delay: number; reason: string }
  | { type: "stopped" }
  | { type: "fatal"; code: RemoteProtocol.FatalCode; message: string }

export type Timing = {
  heartbeat: number
  deadAfter: number
  helloTimeout: number
  backoffBase: number
  backoffCap: number
  // A connection must stay ready this long before a drop resets the backoff,
  // so a relay that accepts and immediately crashes still backs off.
  stableAfter: number
  probeTimeout: number
  watchInterval: number
  wakeThreshold: number
}

export const defaults: Timing = {
  heartbeat: RemoteProtocol.HEARTBEAT,
  deadAfter: RemoteProtocol.DEAD_AFTER,
  helloTimeout: RemoteProtocol.HELLO_TIMEOUT,
  backoffBase: 1_000,
  backoffCap: 30_000,
  stableAfter: 10_000,
  probeTimeout: 5_000,
  watchInterval: 5_000,
  wakeThreshold: 20_000,
}

export type Options = {
  relay: string
  token: string
  envID: string
  name: string
  directory: string
  version: string
  fetch: (request: Request) => Response | Promise<Response>
  headers?: () => Record<string, string> | undefined
  onStatus?: (status: Status) => void
  timing?: Partial<Timing>
}

// Pause reading the local response once this much is queued on the socket.
const SEND_BUFFER_LIMIT = 1024 * 1024

export function nextDelay(attempt: number, timing: Pick<Timing, "backoffBase" | "backoffCap">, random = Math.random) {
  return Math.round(Math.min(timing.backoffCap, timing.backoffBase * 2 ** attempt) * (0.7 + random() * 0.6))
}

export function websocketURL(relay: string) {
  const url = new URL(relay)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = url.pathname.replace(/\/$/, "") + "/agent/connect"
  url.search = ""
  url.hash = ""
  return url.toString()
}

type Inflight = {
  abort: AbortController
  cancelled: boolean
  reader?: ReadableStreamDefaultReader<Uint8Array>
}

type Upload = {
  message: Extract<RemoteProtocol.RelayMessage, { type: "req" }>
  parts: Uint8Array[]
  size: number
}

type Connection = {
  ws: WebSocket
  openedAt: number
  readyAt?: number
  lastSeen: number
  lastPing: number
  probeAt?: number
  probeReason?: string
  closed: boolean
  goaway: boolean
  inflight: Map<number, Inflight>
  uploads: Map<number, Upload>
  timer: ReturnType<typeof setInterval>
}

export function start(options: Options) {
  const timing = { ...defaults, ...options.timing }
  const instanceID = crypto.randomUUID()
  let current: Connection | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  let stopped = false
  let fatal: Extract<RemoteProtocol.RelayMessage, { type: "fatal" }> | undefined
  let status: Status = { type: "connecting", attempt: 0 }

  const setStatus = (next: Status) => {
    status = next
    options.onStatus?.(next)
  }

  // Sleep/wake shows up as a timer that fired far too late; network changes as
  // a different set of interface addresses. Both only trigger a probe, so a
  // healthy connection survives a spurious change (e.g. IPv6 privacy rotation).
  let lastTick = Date.now()
  let network = signature()
  const watcher = setInterval(() => {
    const now = Date.now()
    const slept = now - lastTick > timing.wakeThreshold
    lastTick = now
    const next = signature()
    const changed = next !== network
    network = next
    if (slept) return probe("wake")
    if (changed) return probe("network")
  }, timing.watchInterval)

  connect()

  return {
    status: () => status,
    instanceID,
    probe,
    stop,
  }

  function connect() {
    retry = undefined
    setStatus({ type: "connecting", attempt })
    current = open()
  }

  function probe(reason: string) {
    if (stopped || fatal) return
    if (retry) {
      clearTimeout(retry)
      attempt = 0
      connect()
      return
    }
    if (!current?.readyAt) return
    if (current.probeAt) return
    current.probeAt = Date.now()
    current.probeReason = reason
    send(current, { type: "ping", t: current.probeAt })
  }

  async function stop() {
    if (stopped) return
    stopped = true
    clearInterval(watcher)
    if (retry) clearTimeout(retry)
    retry = undefined
    const conn = current
    if (conn) {
      send(conn, { type: "bye" })
      const closed = new Promise((resolve) => conn.ws.addEventListener("close", resolve))
      drop(conn, "stopped")
      await Promise.race([closed, Bun.sleep(1_000)])
    }
    setStatus({ type: "stopped" })
  }

  function open() {
    const ws = new WebSocket(websocketURL(options.relay))
    ws.binaryType = "arraybuffer"
    const now = Date.now()
    const conn: Connection = {
      ws,
      openedAt: now,
      lastSeen: now,
      lastPing: now,
      closed: false,
      goaway: false,
      inflight: new Map(),
      uploads: new Map(),
      timer: setInterval(() => check(conn), Math.min(1_000, timing.heartbeat)),
    }
    ws.addEventListener("open", () =>
      send(conn, {
        type: "hello",
        protocol: RemoteProtocol.VERSION,
        token: options.token,
        envID: options.envID,
        instanceID,
        name: options.name,
        directory: options.directory,
        version: options.version,
      }),
    )
    ws.addEventListener("message", (event) => {
      if (conn.closed) return
      conn.lastSeen = Date.now()
      if (typeof event.data === "string") return control(conn, event.data)
      if (event.data instanceof ArrayBuffer) return body(conn, new Uint8Array(event.data))
    })
    ws.addEventListener("close", (event) => drop(conn, `closed (${event.code}${event.reason ? " " + event.reason : ""})`))
    ws.addEventListener("error", () => drop(conn, "socket error"))
    return conn
  }

  function check(conn: Connection) {
    const now = Date.now()
    if (!conn.readyAt && now - conn.openedAt > timing.helloTimeout) return drop(conn, "connect timeout")
    if (!conn.readyAt) return
    if (now - conn.lastSeen > timing.deadAfter) return drop(conn, "heartbeat timeout")
    if (conn.probeAt && conn.lastSeen >= conn.probeAt) conn.probeAt = undefined
    if (conn.probeAt && now - conn.probeAt > timing.probeTimeout) return drop(conn, `no response after ${conn.probeReason}`)
    if (now - conn.lastPing < timing.heartbeat) return
    conn.lastPing = now
    send(conn, { type: "ping", t: now })
  }

  // Idempotent teardown. We never wait for the socket's close event: on a
  // half-open TCP connection it may not arrive for minutes.
  function drop(conn: Connection, reason: string) {
    if (conn.closed) return
    conn.closed = true
    clearInterval(conn.timer)
    conn.uploads.clear()
    conn.inflight.forEach((_, id) => cancel(conn, id))
    if (conn.ws.readyState === WebSocket.CONNECTING || conn.ws.readyState === WebSocket.OPEN) conn.ws.close()
    if (conn !== current) return
    current = undefined
    if (stopped) return
    if (fatal) {
      clearInterval(watcher)
      setStatus({ type: "fatal", code: fatal.code, message: fatal.message })
      return
    }
    if (conn.readyAt && Date.now() - conn.readyAt >= timing.stableAfter) attempt = 0
    if (conn.goaway) return schedule(500 + Math.round(Math.random() * 2_500), "relay restarting")
    schedule(nextDelay(attempt++, timing), reason)
  }

  function schedule(delay: number, reason: string) {
    setStatus({ type: "waiting", attempt, delay, reason })
    retry = setTimeout(connect, delay)
  }

  function control(conn: Connection, text: string) {
    const message = RemoteProtocol.parseRelayMessage(text)
    if (!message) return
    switch (message.type) {
      case "welcome":
        conn.readyAt = Date.now()
        setStatus({ type: "ready" })
        return
      case "fatal":
        fatal = message
        drop(conn, message.message)
        return
      case "ping":
        send(conn, { type: "pong", t: message.t })
        return
      case "pong":
        return
      case "goaway":
        conn.goaway = true
        return
      case "req":
        if (message.body) {
          conn.uploads.set(message.id, { message, parts: [], size: 0 })
          return
        }
        void dispatch(conn, message.id, message)
        return
      case "req-end": {
        const upload = conn.uploads.get(message.id)
        if (!upload) return
        conn.uploads.delete(message.id)
        void dispatch(conn, message.id, upload.message, Buffer.concat(upload.parts))
        return
      }
      case "cancel":
        conn.uploads.delete(message.id)
        cancel(conn, message.id)
        return
    }
  }

  function body(conn: Connection, frame: Uint8Array) {
    const decoded = RemoteProtocol.decodeBody(frame)
    if (!decoded || decoded.kind !== RemoteProtocol.BodyKind.request) return
    const upload = conn.uploads.get(decoded.id)
    if (!upload) return
    upload.size += decoded.payload.byteLength
    if (upload.size > RemoteProtocol.MAX_REQUEST_BODY) {
      conn.uploads.delete(decoded.id)
      send(conn, { type: "res-error", id: decoded.id, message: "request body too large" })
      return
    }
    upload.parts.push(decoded.payload)
  }

  async function dispatch(
    conn: Connection,
    id: number,
    message: Extract<RemoteProtocol.RelayMessage, { type: "req" }>,
    payload?: Uint8Array<ArrayBuffer>,
  ) {
    const entry: Inflight = { abort: new AbortController(), cancelled: false }
    conn.inflight.set(id, entry)
    const response = await Promise.resolve()
      .then(() => options.fetch(localRequest(message, payload, entry.abort.signal)))
      .catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))))
    if (response instanceof Error) {
      conn.inflight.delete(id)
      send(conn, { type: "res-error", id, message: response.message })
      return
    }
    // Cancelled while the handler ran: it has finished its work, only the
    // transfer is pointless now. Mutations are never interrupted this way.
    if (entry.cancelled) {
      conn.inflight.delete(id)
      await response.body?.cancel().catch(() => {})
      return
    }
    send(conn, {
      type: "res",
      id,
      status: response.status,
      headers: [...response.headers].filter((header) => RemoteProtocol.forwardable(header[0])),
    })
    if (!response.body) {
      conn.inflight.delete(id)
      send(conn, { type: "res-end", id })
      return
    }
    entry.reader = response.body.getReader()
    await pump(conn, id, entry, entry.reader)
    conn.inflight.delete(id)
  }

  async function pump(
    conn: Connection,
    id: number,
    entry: Inflight,
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ) {
    while (true) {
      const chunk = await reader.read().catch(() => undefined)
      if (entry.cancelled) return
      if (!chunk) return send(conn, { type: "res-error", id, message: "response stream failed" })
      if (chunk.done) return send(conn, { type: "res-end", id })
      for (const part of RemoteProtocol.chunks(chunk.value)) {
        sendBinary(conn, RemoteProtocol.encodeBody(RemoteProtocol.BodyKind.response, id, part))
      }
      while (!conn.closed && !entry.cancelled && conn.ws.bufferedAmount > SEND_BUFFER_LIMIT) await Bun.sleep(10)
    }
  }

  function cancel(conn: Connection, id: number) {
    const entry = conn.inflight.get(id)
    if (!entry || entry.cancelled) return
    entry.cancelled = true
    if (!entry.reader) return
    entry.reader.cancel().catch(() => {})
    entry.abort.abort()
  }

  function localRequest(
    message: Extract<RemoteProtocol.RelayMessage, { type: "req" }>,
    payload: Uint8Array<ArrayBuffer> | undefined,
    signal: AbortSignal,
  ) {
    const url = new URL(message.path, "http://mrtoro.internal")
    // An environment is pinned to the directory remote-control was started in.
    url.searchParams.delete("directory")
    url.searchParams.delete("location[directory]")
    const headers = new Headers(message.headers.filter((header) => RemoteProtocol.forwardable(header[0])))
    headers.set("x-opencode-directory", encodeURIComponent(options.directory))
    Object.entries(options.headers?.() ?? {}).forEach((entry) => headers.set(entry[0], entry[1]))
    const method = message.method.toUpperCase()
    return new Request(url, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : payload,
      signal,
    })
  }

  function send(conn: Connection, message: RemoteProtocol.AgentMessage) {
    if (conn.closed || conn.ws.readyState !== WebSocket.OPEN) return
    conn.ws.send(JSON.stringify(message))
  }

  function sendBinary(conn: Connection, frame: Uint8Array) {
    if (conn.closed || conn.ws.readyState !== WebSocket.OPEN) return
    conn.ws.send(frame)
  }
}

function signature() {
  return Object.entries(os.networkInterfaces())
    .flatMap((entry) => (entry[1] ?? []).filter((addr) => !addr.internal).map((addr) => `${entry[0]}/${addr.address}`))
    .sort()
    .join(",")
}
