export * as RemoteEnvironment from "./environment"

import fs from "fs/promises"
import path from "path"
import { Global } from "@opencode-ai/core/global"
import { RemoteProtocol } from "./protocol"

// The environment ID is stable per directory so the web URL survives restarts
// and reconnects of `mrtoro remote-control`.
export async function id(directory: string, file = path.join(Global.Path.data, "remote-control.json")) {
  const existing = (await read(file))[directory]
  if (existing && RemoteProtocol.ENV_ID.test(existing)) return existing
  const created = RemoteProtocol.createEnvID()
  // Re-read right before writing so concurrent runs in other directories are kept.
  const environments = { ...(await read(file)), [directory]: created }
  const tmp = `${file}.${process.pid}.tmp`
  await Bun.write(tmp, JSON.stringify({ environments }, null, 2))
  await fs.rename(tmp, file)
  return created
}

async function read(file: string): Promise<Record<string, string>> {
  const data: unknown = await Bun.file(file)
    .json()
    .catch(() => undefined)
  if (typeof data !== "object" || data === null || !("environments" in data)) return {}
  if (typeof data.environments !== "object" || data.environments === null) return {}
  return Object.fromEntries(
    Object.entries(data.environments).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  )
}
