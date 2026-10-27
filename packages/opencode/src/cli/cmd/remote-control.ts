import os from "os"
import { Effect } from "effect"
import { effectCmd, fail } from "../effect-cmd"
import { UI } from "../ui"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { Filesystem } from "@/util/filesystem"
import type { RemoteAgent } from "@/remote/agent"

export const RemoteControlCommand = effectCmd({
  command: "remote-control",
  describe: "let the web relay control mrtoro in this directory",
  builder: (yargs) =>
    yargs
      .option("relay", {
        type: "string",
        describe: "relay URL (defaults to MRTORO_RELAY_URL)",
      })
      .option("token", {
        type: "string",
        describe: "relay token (defaults to MRTORO_RELAY_TOKEN)",
      })
      .option("name", {
        type: "string",
        describe: "name shown in the web UI (defaults to the hostname)",
      }),
  // Requests carry x-opencode-directory, so no ambient instance is needed.
  instance: false,
  handler: Effect.fn("Cli.remoteControl")(function* (args) {
    const relay = args.relay ?? process.env.MRTORO_RELAY_URL
    const token = args.token ?? process.env.MRTORO_RELAY_TOKEN
    if (!relay) return yield* fail("missing relay URL: pass --relay or set MRTORO_RELAY_URL")
    if (!token) return yield* fail("missing relay token: pass --token or set MRTORO_RELAY_TOKEN")
    if (!URL.canParse(relay) || !/^https?:$/.test(new URL(relay).protocol))
      return yield* fail(`invalid relay URL: ${relay}`)

    const { Server } = yield* Effect.promise(() => import("../../server/server"))
    const { ServerAuth } = yield* Effect.promise(() => import("../../server/auth"))
    const { RemoteAgent } = yield* Effect.promise(() => import("../../remote/agent"))
    const { RemoteEnvironment } = yield* Effect.promise(() => import("../../remote/environment"))
    const { InstanceRuntime } = yield* Effect.promise(() => import("../../project/instance-runtime"))

    const directory = Filesystem.resolve(process.env.PWD ?? process.cwd())
    const envID = yield* Effect.promise(() => RemoteEnvironment.id(directory))
    const endpoint = new URL(`api/env/${envID}/`, relay.endsWith("/") ? relay : relay + "/").toString()

    UI.println(UI.Style.TEXT_NORMAL_BOLD + "Remote control" + UI.Style.TEXT_NORMAL, directory)
    UI.println(UI.Style.TEXT_DIM + "Environment " + envID + UI.Style.TEXT_NORMAL)

    const exited = Promise.withResolvers<number>()
    const agent = RemoteAgent.start({
      relay,
      token,
      envID,
      name: args.name ?? os.hostname(),
      directory,
      version: InstallationVersion,
      fetch: (request) => Server.Default().app.fetch(request),
      headers: () => ServerAuth.headers(),
      onStatus: (status) => {
        UI.println(describe(status, endpoint))
        if (status.type === "fatal") exited.resolve(1)
      },
    })

    const shutdown = () => exited.resolve(0)
    process.once("SIGINT", shutdown)
    process.once("SIGTERM", shutdown)

    const code = yield* Effect.promise(() => exited.promise)
    yield* Effect.promise(() => agent.stop())
    yield* Effect.promise(() => InstanceRuntime.disposeAllInstances())
    process.exitCode = code
  }),
})

function describe(status: RemoteAgent.Status, endpoint: string) {
  const time = UI.Style.TEXT_DIM + new Date().toLocaleTimeString() + UI.Style.TEXT_NORMAL
  if (status.type === "connecting")
    return `${time} connecting${status.attempt ? ` (attempt ${status.attempt + 1})` : ""}…`
  if (status.type === "ready") return `${time} ${UI.Style.TEXT_SUCCESS_BOLD}connected${UI.Style.TEXT_NORMAL} ${endpoint}`
  if (status.type === "waiting")
    return `${time} ${UI.Style.TEXT_WARNING}disconnected${UI.Style.TEXT_NORMAL}: ${status.reason}; retrying in ${(status.delay / 1000).toFixed(1)}s`
  if (status.type === "fatal")
    return `${time} ${UI.Style.TEXT_DANGER_BOLD}${status.code}${UI.Style.TEXT_NORMAL}: ${status.message}`
  return `${time} stopped`
}
