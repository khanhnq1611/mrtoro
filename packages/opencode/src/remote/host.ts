export * as RemoteHost from "./host"

import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { RemoteAgent } from "./agent"
import { RemoteCredentials } from "./credentials"
import { RemoteEnvironment } from "./environment"

// Mirrors RemoteControlStatus in @opencode-ai/tui; kept structural so this
// module does not depend on the TUI package.
export type Status =
  | { type: "off" }
  | { type: "connecting" }
  | { type: "online"; url: string }
  | { type: "reconnecting"; reason: string; delay: number }
  | { type: "failed"; message: string }

// Remote control started from inside a running mrtoro (the TUI's
// /remote-control), next to its server so both drive the same sessions.
export function create(input: {
  fetch: (request: Request) => Response | Promise<Response>
  headers?: () => Record<string, string> | undefined
  emit: (status: Status) => void
  credentials?: () => Promise<RemoteCredentials.Info | undefined>
  environment?: (directory: string) => Promise<string>
  timing?: Partial<RemoteAgent.Timing>
}) {
  let agent: ReturnType<typeof RemoteAgent.start> | undefined
  // Identifies the current run. Set before RemoteAgent.start, which reports
  // its first status synchronously, and cleared on stop so late statuses
  // from a stopped agent are ignored.
  let run: object | undefined
  let status: Status = { type: "off" }
  const set = (next: Status) => {
    status = next
    input.emit(next)
  }

  return {
    status: () => status,
    async start(options: { directory: string; name: string }) {
      if (run) return status
      const current = {}
      run = current
      set({ type: "connecting" })
      const credentials = await (input.credentials ?? (() => RemoteCredentials.read()))()
      if (run !== current) return status
      if (!credentials) {
        run = undefined
        set({ type: "failed", message: "not logged in: run `mrtoro remote-control login <relay-url>` in a shell" })
        return status
      }
      const envID = await (input.environment ?? RemoteEnvironment.id)(options.directory)
      if (run !== current) return status
      const url = `${credentials.relay}/env/${envID}/`
      agent = RemoteAgent.start({
        relay: credentials.relay,
        token: credentials.token,
        envID,
        name: options.name,
        directory: options.directory,
        version: InstallationVersion,
        fetch: input.fetch,
        headers: input.headers,
        timing: input.timing,
        onStatus: (next) => {
          if (run !== current) return
          if (next.type === "connecting") return set({ type: "connecting" })
          if (next.type === "ready") return set({ type: "online", url })
          if (next.type === "waiting") return set({ type: "reconnecting", reason: next.reason, delay: next.delay })
          if (next.type === "fatal") {
            run = undefined
            agent = undefined
            return set({ type: "failed", message: next.message })
          }
        },
      })
      return status
    },
    async stop() {
      const current = agent
      run = undefined
      agent = undefined
      await current?.stop()
      set({ type: "off" })
    },
  }
}
