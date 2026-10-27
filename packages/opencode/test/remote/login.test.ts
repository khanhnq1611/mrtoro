import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { RemoteCredentials } from "../../src/remote/credentials"
import { RemoteLogin } from "../../src/remote/login"
import { tmpdir } from "../fixture/fixture"

const servers: { stop: (force: boolean) => unknown }[] = []
afterEach(() => {
  servers.splice(0).forEach((server) => server.stop(true))
})

// A relay whose /device/token answers follow a script, one entry per poll.
function relay(script: (number | Record<string, unknown>)[], code: Record<string, unknown> = {}) {
  const polls: unknown[] = []
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url)
      if (url.pathname === "/device/code")
        return Response.json({
          device_code: "secret-device-code",
          user_code: "BCDF-GHJK",
          verification_uri_complete: `${url.origin}/device?code=BCDF-GHJK`,
          expires_in: 30,
          interval: 1,
          ...code,
        })
      if (url.pathname === "/device/token") {
        polls.push(await req.json())
        const next = script[Math.min(polls.length - 1, script.length - 1)]
        if (typeof next === "number") return new Response("unavailable", { status: next })
        return Response.json(next, { status: "error" in next ? 400 : 200 })
      }
      if (url.pathname === "/device/revoke")
        return new Response(null, { status: req.headers.get("authorization") === "Bearer good" ? 204 : 401 })
      if (url.pathname === "/device/whoami")
        return req.headers.get("authorization") === "Bearer good"
          ? Response.json({ device_id: "dev_1" })
          : new Response(null, { status: 401 })
      return new Response("<html>not a relay</html>", { headers: { "content-type": "text/html" } })
    },
  })
  servers.push(server)
  return { url: `http://127.0.0.1:${server.port}`, polls }
}

const approved = {
  device_token: "mrd_token",
  device_id: "dev_1",
  device_name: "laptop",
  email: "alice@example.com",
  name: "Alice",
}

describe("RemoteLogin.login", () => {
  test("shows the code, polls while pending, and returns credentials", async () => {
    const server = relay([{ error: "authorization_pending" }, approved])
    const codes: RemoteLogin.Code[] = []
    const result = await RemoteLogin.login({ relay: server.url + "/", name: "laptop", onCode: (code) => codes.push(code) })
    expect(codes[0]).toMatchObject({ userCode: "BCDF-GHJK", url: `${server.url}/device?code=BCDF-GHJK` })
    expect(server.polls).toEqual([{ device_code: "secret-device-code" }, { device_code: "secret-device-code" }])
    expect(result).toEqual({
      type: "approved",
      credentials: { relay: server.url, token: "mrd_token", deviceID: "dev_1", deviceName: "laptop", email: "alice@example.com" },
    })
  })

  test("survives a relay hiccup while waiting", async () => {
    const server = relay([503, approved])
    const result = await RemoteLogin.login({ relay: server.url, name: "laptop", onCode: () => {} })
    expect(result.type).toBe("approved")
  })

  test("reports a denied request", async () => {
    const server = relay([{ error: "access_denied" }])
    expect(await RemoteLogin.login({ relay: server.url, name: "laptop", onCode: () => {} })).toEqual({ type: "denied" })
  })

  test("reports an expired code", async () => {
    const server = relay([{ error: "expired_token" }])
    expect(await RemoteLogin.login({ relay: server.url, name: "laptop", onCode: () => {} })).toEqual({ type: "expired" })
  })

  test("refuses something that is not a relay", async () => {
    const server = relay([], { device_code: undefined })
    const error = await RemoteLogin.login({ relay: server.url, name: "laptop", onCode: () => {} }).catch((error: unknown) => error)
    expect(error).toBeInstanceOf(Error)
    expect(String(error)).toContain("unexpected response")
  })

  test("revoke and whoami tell valid tokens from revoked ones", async () => {
    const server = relay([])
    expect(await RemoteLogin.revoke({ relay: server.url, token: "good" })).toBe(true)
    expect(await RemoteLogin.whoami({ relay: server.url, token: "good" })).toEqual({ type: "valid" })
    expect(await RemoteLogin.whoami({ relay: server.url, token: "bad" })).toEqual({ type: "revoked" })
    expect(await RemoteLogin.whoami({ relay: "http://127.0.0.1:1", token: "good" })).toEqual({ type: "unreachable" })
  })
})

describe("RemoteCredentials", () => {
  test("round-trips through an owner-only file", async () => {
    await using tmp = await tmpdir()
    const file = path.join(tmp.path, "auth.json")
    const info = { relay: "https://relay.example.com", token: "mrd_x", deviceID: "dev_1", deviceName: "laptop", email: "a@b.c" }
    await RemoteCredentials.write(info, file)
    expect(await RemoteCredentials.read(file)).toEqual(info)
    expect((await fs.stat(file)).mode & 0o777).toBe(0o600)
    await RemoteCredentials.remove(file)
    expect(await RemoteCredentials.read(file)).toBeUndefined()
  })

  test("ignores malformed files", async () => {
    await using tmp = await tmpdir()
    const file = path.join(tmp.path, "auth.json")
    await Bun.write(file, JSON.stringify({ relay: "x", token: 42 }))
    expect(await RemoteCredentials.read(file)).toBeUndefined()
    await Bun.write(file, "not json")
    expect(await RemoteCredentials.read(file)).toBeUndefined()
  })
})
