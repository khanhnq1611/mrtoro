export * as RemoteAutoApprove from "./auto-approve"

import { GlobalBus, type GlobalEvent } from "@/bus/global"

export type Approval = { id: string; permission: string; patterns: string[] }

// Answers "once" to every permission the rules leave at "ask", like the TUI's
// auto mode, but on the machine itself, so it holds whoever drives from the
// web. "deny" rules never ask, so they keep blocking.
export function start(input: {
  fetch: (request: Request) => Response | Promise<Response>
  directory: string
  headers?: () => Record<string, string> | undefined
  onApprove?: (approval: Approval) => void
}) {
  const handler = (event: GlobalEvent) => {
    const approval = permissionRequest(event.payload)
    if (!approval) return
    const headers = new Headers({
      "content-type": "application/json",
      "x-opencode-directory": encodeURIComponent(event.directory ?? input.directory),
    })
    Object.entries(input.headers?.() ?? {}).forEach((entry) => headers.set(entry[0], entry[1]))
    const request = new Request(`http://mrtoro.internal/permission/${encodeURIComponent(approval.id)}/reply`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reply: "once" }),
    })
    // The same request can arrive as a v1 and a v2 event; the second reply
    // finds nothing to answer and is ignored.
    void Promise.resolve()
      .then(() => input.fetch(request))
      .then((response) => {
        if (response.ok) input.onApprove?.(approval)
      })
      .catch(() => {})
  }
  GlobalBus.on("event", handler)
  return () => {
    GlobalBus.off("event", handler)
  }
}

function permissionRequest(payload: unknown): Approval | undefined {
  if (typeof payload !== "object" || payload === null) return undefined
  if (!("type" in payload) || payload.type !== "permission.asked") return undefined
  const body = "properties" in payload ? payload.properties : "data" in payload ? payload.data : undefined
  if (typeof body !== "object" || body === null || !("id" in body) || typeof body.id !== "string") return undefined
  return {
    id: body.id,
    permission: "permission" in body && typeof body.permission === "string" ? body.permission : "unknown",
    patterns:
      "patterns" in body && Array.isArray(body.patterns)
        ? body.patterns.filter((pattern): pattern is string => typeof pattern === "string")
        : [],
  }
}
