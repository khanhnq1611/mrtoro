import os from "os"
import { Effect } from "effect"
import { effectCmd, fail } from "../effect-cmd"
import { UI } from "../ui"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { Filesystem } from "@/util/filesystem"
import type { RemoteAgent } from "@/remote/agent"

const RemoteControlLoginCommand = effectCmd({
  command: "login [relay]",
  describe: "link this machine to your account on a relay",
  builder: (yargs) =>
    yargs
      .positional("relay", {
        type: "string",
        describe: "relay URL, e.g. https://relay.example.com (defaults to MRTORO_RELAY_URL or the current relay)",
      })
      .option("name", {
        type: "string",
        describe: "device name shown in the web UI (defaults to the hostname)",
      }),
  instance: false,
  handler: Effect.fn("Cli.remoteControl.login")(function* (args) {
    const { RemoteCredentials } = yield* Effect.promise(() => import("../../remote/credentials"))
    const { RemoteLogin } = yield* Effect.promise(() => import("../../remote/login"))
    const previous = yield* Effect.promise(() => RemoteCredentials.read())
    const relay = args.relay ?? process.env.MRTORO_RELAY_URL ?? previous?.relay
    if (!relay) return yield* fail("pass the relay URL: mrtoro remote-control login https://relay.example.com")
    if (!URL.canParse(relay) || !/^https?:$/.test(new URL(relay).protocol))
      return yield* fail(`invalid relay URL: ${relay}`)

    const result = yield* Effect.tryPromise({
      try: () =>
        RemoteLogin.login({
          relay: new URL(relay).origin,
          name: args.name ?? os.hostname(),
          onCode: (code) => {
            UI.empty()
            UI.println("Open this page and approve the request:")
            UI.println("  " + UI.Style.TEXT_HIGHLIGHT_BOLD + code.url + UI.Style.TEXT_NORMAL)
            UI.println("Confirm it shows the code " + UI.Style.TEXT_NORMAL_BOLD + code.userCode + UI.Style.TEXT_NORMAL)
            UI.empty()
            UI.println(UI.Style.TEXT_DIM + "Waiting for approval…" + UI.Style.TEXT_NORMAL)
          },
        }),
      catch: (error) => (error instanceof Error ? error.message : String(error)),
    }).pipe(Effect.catch((message) => fail(`login failed: ${message}`)))
    if (result.type === "denied") return yield* fail("the request was denied in the browser")
    if (result.type === "expired") return yield* fail("the code expired; run the command again")

    yield* Effect.promise(() => RemoteCredentials.write(result.credentials))
    // The old device would otherwise stay valid, and keep owning this machine's
    // environments, until someone revoked it by hand.
    if (previous && previous.token !== result.credentials.token)
      yield* Effect.promise(() => RemoteLogin.revoke(previous))
    UI.println(
      UI.Style.TEXT_SUCCESS_BOLD + "Linked" + UI.Style.TEXT_NORMAL,
      `as ${result.credentials.deviceName} for ${result.credentials.email}.`,
      "Run `mrtoro remote-control` in a project directory to start.",
    )
  }),
})

const RemoteControlLogoutCommand = effectCmd({
  command: "logout",
  describe: "unlink this machine from the relay",
  instance: false,
  handler: Effect.fn("Cli.remoteControl.logout")(function* () {
    const { RemoteCredentials } = yield* Effect.promise(() => import("../../remote/credentials"))
    const { RemoteLogin } = yield* Effect.promise(() => import("../../remote/login"))
    const credentials = yield* Effect.promise(() => RemoteCredentials.read())
    if (!credentials) {
      UI.println("Not logged in.")
      return
    }
    const revoked = yield* Effect.promise(() => RemoteLogin.revoke(credentials))
    yield* Effect.promise(() => RemoteCredentials.remove())
    UI.println(
      revoked
        ? `Logged out of ${credentials.relay}.`
        : `Removed local credentials, but ${credentials.relay} was unreachable: revoke "${credentials.deviceName}" in its web UI.`,
    )
  }),
})

const RemoteControlStatusCommand = effectCmd({
  command: "status",
  describe: "show the relay login and this directory's environment",
  instance: false,
  handler: Effect.fn("Cli.remoteControl.status")(function* () {
    const { RemoteCredentials } = yield* Effect.promise(() => import("../../remote/credentials"))
    const { RemoteLogin } = yield* Effect.promise(() => import("../../remote/login"))
    const { RemoteEnvironment } = yield* Effect.promise(() => import("../../remote/environment"))
    const credentials = yield* Effect.promise(() => RemoteCredentials.read())
    if (!credentials) {
      UI.println("Not logged in. Run: mrtoro remote-control login <relay-url>")
      return
    }
    const check = yield* Effect.promise(() => RemoteLogin.whoami(credentials))
    const directory = Filesystem.resolve(process.env.PWD ?? process.cwd())
    UI.println("Relay       ", credentials.relay)
    UI.println("Account     ", credentials.email)
    UI.println("Device      ", credentials.deviceName)
    UI.println(
      "Login       ",
      check.type === "valid"
        ? UI.Style.TEXT_SUCCESS + "valid" + UI.Style.TEXT_NORMAL
        : check.type === "revoked"
          ? UI.Style.TEXT_DANGER + "revoked (run login again)" + UI.Style.TEXT_NORMAL
          : UI.Style.TEXT_WARNING + "relay unreachable" + UI.Style.TEXT_NORMAL,
    )
    UI.println("Environment ", (yield* Effect.promise(() => RemoteEnvironment.id(directory))) + "  " + directory)
  }),
})

export const RemoteControlCommand = effectCmd({
  command: "remote-control",
  describe: "control mrtoro in this directory from the web",
  builder: (yargs) =>
    yargs
      .command(RemoteControlLoginCommand)
      .command(RemoteControlLogoutCommand)
      .command(RemoteControlStatusCommand)
      .option("name", {
        type: "string",
        describe: "machine name shown in the web UI (defaults to the hostname)",
      }),
  // Requests carry x-opencode-directory, so no ambient instance is needed.
  instance: false,
  handler: Effect.fn("Cli.remoteControl")(function* (args) {
    const { RemoteCredentials } = yield* Effect.promise(() => import("../../remote/credentials"))
    const credentials = yield* Effect.promise(() => RemoteCredentials.read())
    if (!credentials) return yield* fail("not logged in: run `mrtoro remote-control login <relay-url>` first")

    const { Server } = yield* Effect.promise(() => import("../../server/server"))
    const { ServerAuth } = yield* Effect.promise(() => import("../../server/auth"))
    const { RemoteAgent } = yield* Effect.promise(() => import("../../remote/agent"))
    const { RemoteEnvironment } = yield* Effect.promise(() => import("../../remote/environment"))
    const { InstanceRuntime } = yield* Effect.promise(() => import("../../project/instance-runtime"))

    const directory = Filesystem.resolve(process.env.PWD ?? process.cwd())
    const envID = yield* Effect.promise(() => RemoteEnvironment.id(directory))

    UI.println(UI.Style.TEXT_NORMAL_BOLD + "Remote control" + UI.Style.TEXT_NORMAL, directory)
    UI.println(UI.Style.TEXT_DIM + `${credentials.email} · ${credentials.relay} · ${envID}` + UI.Style.TEXT_NORMAL)

    const exited = Promise.withResolvers<number>()
    const agent = RemoteAgent.start({
      relay: credentials.relay,
      token: credentials.token,
      envID,
      name: args.name ?? os.hostname(),
      directory,
      version: InstallationVersion,
      fetch: (request) => Server.Default().app.fetch(request),
      headers: () => ServerAuth.headers(),
      onStatus: (status) => {
        UI.println(describe(status, credentials.relay))
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

function describe(status: RemoteAgent.Status, relay: string) {
  const time = UI.Style.TEXT_DIM + new Date().toLocaleTimeString() + UI.Style.TEXT_NORMAL
  if (status.type === "connecting")
    return `${time} connecting${status.attempt ? ` (attempt ${status.attempt + 1})` : ""}…`
  if (status.type === "ready")
    return `${time} ${UI.Style.TEXT_SUCCESS_BOLD}connected${UI.Style.TEXT_NORMAL} open ${relay} to control this machine`
  if (status.type === "waiting")
    return `${time} ${UI.Style.TEXT_WARNING}disconnected${UI.Style.TEXT_NORMAL}: ${status.reason}; retrying in ${(status.delay / 1000).toFixed(1)}s`
  if (status.type === "fatal")
    return `${time} ${UI.Style.TEXT_DANGER_BOLD}${status.code}${UI.Style.TEXT_NORMAL}: ${status.message}`
  return `${time} stopped`
}
