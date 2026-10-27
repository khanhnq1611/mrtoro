import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import type { ServerWebSocket } from "bun"
import { RemoteAgent } from "../../src/remote/agent"
import { RemoteEnvironment } from "../../src/remote/environment"
import { RemoteProtocol } from "../../src/remote/protocol"
import { tmpdir } from "../fixture/fixture"

type Peer = ServerWebSocket<{ id: number }>

// A real WebSocket server speaking the relay side of the protocol, with knobs
// to misbehave (stay silent, reject, drop).
function relay(behavior: { welcome?: boolean; pong?: boolean; fatal?: RemoteProtocol.FatalCode } = {}) {
  const messages: { peer: number; message: RemoteProtocol.AgentMessage }[] = []
  const frames: { peer: number; frame: ReturnType<typeof RemoteProtocol.decodeBody> }[] = []
  const peers: Peer[] = []
  const server = Bun.serve<{ id: number }>({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req, srv) {
      if (srv.upgrade(req, { data: { id: peers.length } })) return undefined
      return new Response("upgrade required", { status: 400 })
    },
    websocket: {
      open: (ws) => {
        peers.push(ws)
      },
      message: (ws, raw) => {
        if (typeof raw !== "string") {
          frames.push({ peer: ws.data.id, frame: RemoteProtocol.decodeBody(new Uint8Array(raw)) })
          return
        }
        const message = RemoteProtocol.parseAgentMessage(raw)
        if (!message) return
        messages.push({ peer: ws.data.id, message })
        if (message.type === "hello" && behavior.fatal)
          return send(ws, { type: "fatal", code: behavior.fatal, message: "nope" })
        if (message.type === "hello" && behavior.welcome !== false)
          return send(ws, { type: "welcome", envID: message.envID })
        if (message.type === "ping" && behavior.pong !== false) return send(ws, { type: "pong", t: message.t })
      },
    },
  })
  return {
    url: `http://127.0.0.1:${server.port}`,
    messages,
    frames,
    peers,
    behavior,
    hellos: () => messages.filter((entry) => entry.message.type === "hello"),
    of: <T extends RemoteProtocol.AgentMessage["type"]>(type: T) =>
      messages
        .map((entry) => entry.message)
        .filter((message): message is Extract<RemoteProtocol.AgentMessage, { type: T }> => message.type === type),
    send: (message: RemoteProtocol.RelayMessage, peer = peers.length - 1) => send(peers[peer], message),
    // Bun 1.3.14 never settles stop() after a server-side close (its pending
    // socket count stays at 1), so don't wait on it forever.
    stop: () => Promise.race([server.stop(true), Bun.sleep(100)]),
  }
}

function send(ws: Peer, message: RemoteProtocol.RelayMessage) {
  ws.send(JSON.stringify(message))
}

async function until(check: () => boolean, timeout = 3_000) {
  const deadline = Date.now() + timeout
  while (!check()) {
    if (Date.now() > deadline) throw new Error("condition not met in time")
    await Bun.sleep(10)
  }
}

const cleanup: (() => unknown)[] = []
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((fn) => fn()))
})

function start(
  server: ReturnType<typeof relay>,
  fetch: RemoteAgent.Options["fetch"] = () => new Response("ok"),
  timing?: Partial<RemoteAgent.Timing>,
) {
  const statuses: RemoteAgent.Status[] = []
  const agent = RemoteAgent.start({
    relay: server.url,
    token: "secret",
    envID: "env_abcdefghijklmnop1234",
    name: "test",
    directory: "/work/project",
    version: "test",
    fetch,
    onStatus: (status) => statuses.push(status),
    timing: { backoffBase: 20, backoffCap: 100, ...timing },
  })
  cleanup.push(() => agent.stop(), () => server.stop())
  return { agent, statuses }
}

describe("RemoteAgent", () => {
  test("introduces itself and proxies requests with the directory pinned", async () => {
    const server = relay()
    const seen: Request[] = []
    const payload = new Uint8Array(200 * 1024).map((_, index) => index % 251)
    const { agent } = start(server, (request) => {
      seen.push(request)
      return new Response(payload, { headers: { "content-type": "application/octet-stream" } })
    })
    await until(() => agent.status().type === "ready")

    const hello = server.of("hello")[0]
    expect(hello).toMatchObject({ token: "secret", envID: "env_abcdefghijklmnop1234", directory: "/work/project" })
    expect(hello.protocol).toBe(RemoteProtocol.VERSION)

    server.send({
      type: "req",
      id: 7,
      method: "GET",
      path: "/file?directory=/etc&location[directory]=/etc&path=a.txt",
      headers: [
        ["accept", "application/json"],
        ["x-opencode-directory", "/etc"],
      ],
      body: false,
    })
    await until(() => server.of("res-end").length === 1)

    const url = new URL(seen[0].url)
    expect(url.pathname).toBe("/file")
    expect(url.search).toBe("?path=a.txt")
    expect(seen[0].headers.get("x-opencode-directory")).toBe(encodeURIComponent("/work/project"))
    expect(seen[0].headers.get("accept")).toBe("application/json")
    expect(server.of("res")[0]).toMatchObject({ id: 7, status: 200 })

    const parts = server.frames.map((entry) => entry.frame!)
    expect(parts.every((part) => part.id === 7 && part.kind === RemoteProtocol.BodyKind.response)).toBe(true)
    expect(parts.every((part) => part.payload.byteLength <= RemoteProtocol.CHUNK_SIZE)).toBe(true)
    expect(parts.length).toBeGreaterThan(1)
    expect(Buffer.concat(parts.map((part) => part.payload)).equals(Buffer.from(payload))).toBe(true)
  })

  test("reassembles chunked request bodies", async () => {
    const server = relay()
    const bodies: string[] = []
    const { agent } = start(server, async (request) => {
      bodies.push(await request.text())
      return new Response(null, { status: 204 })
    })
    await until(() => agent.status().type === "ready")

    server.send({ type: "req", id: 1, method: "POST", path: "/session", headers: [], body: true })
    ;["hello ", "chunked ", "world"].forEach((part) =>
      server.peers[0].sendBinary(
        RemoteProtocol.encodeBody(RemoteProtocol.BodyKind.request, 1, new TextEncoder().encode(part)),
      ),
    )
    server.send({ type: "req-end", id: 1 })
    await until(() => server.of("res-end").length === 1)
    expect(bodies).toEqual(["hello chunked world"])
    expect(server.of("res")[0].status).toBe(204)
  })

  test("reconnects with the same identity after the relay drops it", async () => {
    const server = relay()
    const { agent, statuses } = start(server)
    await until(() => agent.status().type === "ready")
    server.peers[0].close()
    await until(() => server.hellos().length === 2 && agent.status().type === "ready")

    const hellos = server.of("hello")
    expect(hellos[1].envID).toBe(hellos[0].envID)
    expect(hellos[1].instanceID).toBe(hellos[0].instanceID)
    expect(statuses.some((status) => status.type === "waiting")).toBe(true)
  })

  test("keeps retrying while the relay is unreachable", async () => {
    const server = relay()
    const port = new URL(server.url).port
    await server.stop()
    const { agent, statuses } = start(server)
    await until(() => statuses.filter((status) => status.type === "waiting").length >= 3)
    expect(agent.status().type).not.toBe("fatal")

    // The relay comes back on the same port: the next retry must get through.
    const revived = Bun.serve({
      port: Number(port),
      hostname: "127.0.0.1",
      fetch: (req, srv) => (srv.upgrade(req) ? undefined : new Response("no", { status: 400 })),
      websocket: {
        message: (ws, raw) => {
          const message = RemoteProtocol.parseAgentMessage(String(raw))
          if (message?.type === "hello") ws.send(JSON.stringify({ type: "welcome", envID: message.envID }))
        },
      },
    })
    cleanup.push(() => Promise.race([revived.stop(true), Bun.sleep(100)]))
    await until(() => agent.status().type === "ready")
  })

  test("drops a silent connection after deadAfter and reconnects", async () => {
    const server = relay({ pong: false })
    const { agent, statuses } = start(server, undefined, { heartbeat: 20, deadAfter: 150 })
    await until(() => agent.status().type === "ready")
    await until(() => server.hellos().length === 2)
    expect(statuses.find((status) => status.type === "waiting")).toMatchObject({ reason: "heartbeat timeout" })
  })

  test("gives up connecting when the relay never welcomes it", async () => {
    const server = relay({ welcome: false })
    const { statuses } = start(server, undefined, { helloTimeout: 100 })
    await until(() => statuses.some((status) => status.type === "waiting"))
    expect(statuses.find((status) => status.type === "waiting")).toMatchObject({ reason: "connect timeout" })
  })

  test("stops for good on a fatal rejection", async () => {
    const server = relay({ fatal: "unauthorized" })
    const { agent } = start(server)
    await until(() => agent.status().type === "fatal")
    await Bun.sleep(200)
    expect(server.hellos().length).toBe(1)
    expect(agent.status()).toMatchObject({ type: "fatal", code: "unauthorized" })
  })

  test("lets a handler finish when cancelled before it responds", async () => {
    const server = relay()
    const gate = Promise.withResolvers<void>()
    const finished: string[] = []
    const { agent } = start(server, async () => {
      await gate.promise
      finished.push("done")
      return new Response("late")
    })
    await until(() => agent.status().type === "ready")
    server.send({ type: "req", id: 3, method: "POST", path: "/session/x/message", headers: [], body: false })
    server.send({ type: "cancel", id: 3 })
    await Bun.sleep(20)
    gate.resolve()
    await until(() => finished.length === 1)
    await Bun.sleep(50)
    expect(server.of("res")).toEqual([])
  })

  test("aborts a streaming response cancelled after its headers", async () => {
    const server = relay()
    const cancelled: boolean[] = []
    const { agent } = start(
      server,
      () =>
        new Response(
          new ReadableStream({
            start: (controller) => controller.enqueue(new TextEncoder().encode("data: hi\n\n")),
            cancel: () => {
              cancelled.push(true)
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        ),
    )
    await until(() => agent.status().type === "ready")
    server.send({ type: "req", id: 4, method: "GET", path: "/event", headers: [], body: false })
    await until(() => server.frames.length === 1)
    server.send({ type: "cancel", id: 4 })
    await until(() => cancelled.length === 1)
    expect(server.of("res-end")).toEqual([])
  })

  test("cancels local streams when the connection is lost", async () => {
    const server = relay()
    const cancelled: boolean[] = []
    const { agent } = start(
      server,
      () =>
        new Response(
          new ReadableStream({
            start: (controller) => controller.enqueue(new TextEncoder().encode("data: hi\n\n")),
            cancel: () => {
              cancelled.push(true)
            },
          }),
        ),
    )
    await until(() => agent.status().type === "ready")
    server.send({ type: "req", id: 5, method: "GET", path: "/event", headers: [], body: false })
    await until(() => server.frames.length === 1)
    server.peers[0].close()
    await until(() => cancelled.length === 1)
  })

  test("reconnects promptly after goaway", async () => {
    const server = relay()
    const { agent, statuses } = start(server, undefined, { backoffBase: 60_000, backoffCap: 60_000 })
    await until(() => agent.status().type === "ready")
    server.send({ type: "goaway" })
    server.peers[0].close(1012)
    await until(() => statuses.some((status) => status.type === "waiting"))
    const waiting = statuses.find((status) => status.type === "waiting")
    expect(waiting).toMatchObject({ reason: "relay restarting" })
    expect(waiting?.type === "waiting" && waiting.delay).toBeLessThanOrEqual(3_000)
  })

  test("a probe skips the backoff wait", async () => {
    const server = relay()
    const { agent } = start(server, undefined, { backoffBase: 60_000, backoffCap: 60_000 })
    await until(() => agent.status().type === "ready")
    server.peers[0].close()
    await until(() => agent.status().type === "waiting")
    agent.probe("network")
    await until(() => server.hellos().length === 2, 1_000)
  })

  test("a probe drops a connection that stopped answering", async () => {
    const server = relay()
    const { agent, statuses } = start(server, undefined, { probeTimeout: 50 })
    await until(() => agent.status().type === "ready")
    server.behavior.pong = false
    agent.probe("wake")
    await until(() => statuses.some((status) => status.type === "waiting"), 2_500)
    expect(statuses.find((status) => status.type === "waiting")).toMatchObject({ reason: "no response after wake" })
  })

  test("sends bye when stopped", async () => {
    const server = relay()
    const { agent } = start(server)
    await until(() => agent.status().type === "ready")
    await agent.stop()
    await until(() => server.of("bye").length === 1)
    expect(agent.status().type).toBe("stopped")
  })
})

describe("RemoteAgent helpers", () => {
  test("backoff grows exponentially with jitter and a cap", () => {
    const timing = { backoffBase: 1_000, backoffCap: 30_000 }
    expect(RemoteAgent.nextDelay(0, timing, () => 0)).toBe(700)
    expect(RemoteAgent.nextDelay(0, timing, () => 1)).toBe(1_300)
    expect(RemoteAgent.nextDelay(3, timing, () => 0.5)).toBe(8_000)
    expect(RemoteAgent.nextDelay(50, timing, () => 0.5)).toBe(30_000)
  })

  test("derives the websocket endpoint from the relay URL", () => {
    expect(RemoteAgent.websocketURL("https://relay.example.com")).toBe("wss://relay.example.com/agent/connect")
    expect(RemoteAgent.websocketURL("http://127.0.0.1:8787/base/?x=1")).toBe("ws://127.0.0.1:8787/base/agent/connect")
  })

  test("environment IDs are stable per directory", async () => {
    await using tmp = await tmpdir()
    const file = path.join(tmp.path, "remote-control.json")
    const first = await RemoteEnvironment.id("/a", file)
    const second = await RemoteEnvironment.id("/b", file)
    expect(first).toMatch(RemoteProtocol.ENV_ID)
    expect(second).not.toBe(first)
    expect(await RemoteEnvironment.id("/a", file)).toBe(first)
    expect(await RemoteEnvironment.id("/b", file)).toBe(second)
  })
})
