import { afterEach, describe, expect, test } from "bun:test"
import { RemoteHost } from "../../src/remote/host"
import { RemoteProtocol } from "../../src/remote/protocol"

const cleanup: (() => unknown)[] = []
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((fn) => fn()))
})

// A relay that welcomes every hello, or rejects them all once `reject` is set.
function relay() {
  const messages: RemoteProtocol.AgentMessage[] = []
  const state = { reject: false }
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (req, srv) => (srv.upgrade(req) ? undefined : new Response("no", { status: 400 })),
    websocket: {
      message: (ws, raw) => {
        const message = RemoteProtocol.parseAgentMessage(String(raw))
        if (!message) return
        messages.push(message)
        if (message.type !== "hello") return
        ws.send(
          JSON.stringify(
            state.reject
              ? { type: "fatal", code: "unauthorized", message: "revoked" }
              : { type: "welcome", envID: message.envID },
          ),
        )
      },
    },
  })
  cleanup.push(() => Promise.race([server.stop(true), Bun.sleep(100)]))
  return { url: `http://127.0.0.1:${server.port}`, messages, state }
}

function host(relayURL: string | undefined) {
  const statuses: RemoteHost.Status[] = []
  const remote = RemoteHost.create({
    fetch: () => new Response("ok"),
    emit: (status) => statuses.push(status),
    credentials: async () =>
      relayURL
        ? { relay: relayURL, token: "mrd_token", deviceID: "dev_1", deviceName: "laptop", email: "a@b.c" }
        : undefined,
    environment: async () => "env_abcdefghijklmnop1234",
    timing: { backoffBase: 20, backoffCap: 50 },
  })
  cleanup.push(() => remote.stop())
  return { remote, statuses }
}

async function until(check: () => boolean, timeout = 3_000) {
  const deadline = Date.now() + timeout
  while (!check()) {
    if (Date.now() > deadline) throw new Error("condition not met in time")
    await Bun.sleep(10)
  }
}

describe("RemoteHost", () => {
  test("explains that a login is needed", async () => {
    const { remote, statuses } = host(undefined)
    await remote.start({ directory: "/work", name: "laptop" })
    expect(statuses.at(-1)).toMatchObject({ type: "failed", message: expect.stringContaining("remote-control login") })
  })

  test("goes online with the environment's web URL, once however often it is started", async () => {
    const server = relay()
    const { remote, statuses } = host(server.url)
    await Promise.all([remote.start({ directory: "/work", name: "laptop" }), remote.start({ directory: "/work", name: "laptop" })])
    await until(() => remote.status().type === "online")
    expect(remote.status()).toEqual({ type: "online", url: `${server.url}/env/env_abcdefghijklmnop1234/` })
    expect(statuses[0]).toEqual({ type: "connecting" })
    expect(server.messages.filter((message) => message.type === "hello")).toHaveLength(1)
  })

  test("stopping says goodbye to the relay", async () => {
    const server = relay()
    const { remote, statuses } = host(server.url)
    await remote.start({ directory: "/work", name: "laptop" })
    await until(() => remote.status().type === "online")
    await remote.stop()
    await until(() => server.messages.some((message) => message.type === "bye"))
    expect(statuses.at(-1)).toEqual({ type: "off" })
  })

  test("a revoked device fails and can be started again later", async () => {
    const server = relay()
    server.state.reject = true
    const { remote } = host(server.url)
    await remote.start({ directory: "/work", name: "laptop" })
    await until(() => remote.status().type === "failed")
    expect(remote.status()).toMatchObject({ type: "failed", message: "revoked" })
    server.state.reject = false
    await remote.start({ directory: "/work", name: "laptop" })
    await until(() => remote.status().type === "online")
  })

  test("statuses from a stopped run are ignored", async () => {
    const server = relay()
    const { remote, statuses } = host(server.url)
    const starting = remote.start({ directory: "/work", name: "laptop" })
    await remote.stop()
    await starting
    await Bun.sleep(200)
    expect(statuses.at(-1)).toEqual({ type: "off" })
    expect(server.messages.filter((message) => message.type === "hello")).toEqual([])
  })
})
