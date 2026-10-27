import { afterEach, describe, expect, test } from "bun:test"
import { GlobalBus } from "../../src/bus/global"
import { RemoteAutoApprove } from "../../src/remote/auto-approve"

const stops: (() => void)[] = []
afterEach(() => {
  stops.splice(0).forEach((stop) => stop())
})

function start(status = 200) {
  const requests: Request[] = []
  const approvals: RemoteAutoApprove.Approval[] = []
  stops.push(
    RemoteAutoApprove.start({
      fetch: (request) => {
        requests.push(request)
        return new Response(status === 200 ? "true" : null, { status })
      },
      directory: "/work/project",
      headers: () => ({ authorization: "Basic abc" }),
      onApprove: (approval) => approvals.push(approval),
    }),
  )
  return { requests, approvals }
}

async function settle() {
  await Bun.sleep(10)
}

describe("RemoteAutoApprove", () => {
  test("answers permission requests once, in the event's directory", async () => {
    const { requests, approvals } = start()
    GlobalBus.emit("event", {
      directory: "/work/project/sub",
      payload: {
        type: "permission.asked",
        properties: { id: "per_1", sessionID: "ses_1", permission: "bash", patterns: ["rm -rf build"] },
      },
    })
    await settle()
    expect(requests).toHaveLength(1)
    const request = requests[0]
    expect(request.method).toBe("POST")
    expect(new URL(request.url).pathname).toBe("/permission/per_1/reply")
    expect(await request.json()).toEqual({ reply: "once" })
    expect(request.headers.get("x-opencode-directory")).toBe(encodeURIComponent("/work/project/sub"))
    expect(request.headers.get("authorization")).toBe("Basic abc")
    expect(approvals).toEqual([{ id: "per_1", permission: "bash", patterns: ["rm -rf build"] }])
  })

  test("understands v2 events and falls back to its own directory", async () => {
    const { requests } = start()
    GlobalBus.emit("event", {
      payload: { type: "permission.asked", data: { id: "per_2", sessionID: "ses_1", permission: "edit", patterns: [] } },
    })
    await settle()
    expect(new URL(requests[0].url).pathname).toBe("/permission/per_2/reply")
    expect(requests[0].headers.get("x-opencode-directory")).toBe(encodeURIComponent("/work/project"))
  })

  test("ignores everything that is not a permission request", async () => {
    const { requests } = start()
    GlobalBus.emit("event", { payload: { type: "session.idle", properties: { sessionID: "ses_1" } } })
    GlobalBus.emit("event", { payload: { type: "permission.asked", properties: {} } })
    GlobalBus.emit("event", { payload: null })
    await settle()
    expect(requests).toEqual([])
  })

  test("reports only replies the server accepted", async () => {
    const { requests, approvals } = start(404)
    GlobalBus.emit("event", {
      payload: { type: "permission.asked", properties: { id: "per_3", permission: "bash", patterns: [] } },
    })
    await settle()
    expect(requests).toHaveLength(1)
    expect(approvals).toEqual([])
  })

  test("stops listening when stopped", async () => {
    const { requests } = start()
    stops.splice(0).forEach((stop) => stop())
    GlobalBus.emit("event", {
      payload: { type: "permission.asked", properties: { id: "per_4", permission: "bash", patterns: [] } },
    })
    await settle()
    expect(requests).toEqual([])
  })
})
