export * as RemoteCredentials from "./credentials"

import fs from "fs/promises"
import path from "path"
import { Global } from "@opencode-ai/core/global"

export type Info = {
  relay: string
  token: string
  deviceID: string
  deviceName: string
  email: string
}

const defaultFile = () => path.join(Global.Path.data, "remote-control-auth.json")

export async function read(file = defaultFile()): Promise<Info | undefined> {
  const data: unknown = await Bun.file(file)
    .json()
    .catch(() => undefined)
  if (typeof data !== "object" || data === null) return undefined
  if (!("relay" in data) || typeof data.relay !== "string") return undefined
  if (!("token" in data) || typeof data.token !== "string") return undefined
  if (!("deviceID" in data) || typeof data.deviceID !== "string") return undefined
  if (!("deviceName" in data) || typeof data.deviceName !== "string") return undefined
  if (!("email" in data) || typeof data.email !== "string") return undefined
  return { relay: data.relay, token: data.token, deviceID: data.deviceID, deviceName: data.deviceName, email: data.email }
}

// The device token grants control of this machine's mrtoro: owner-only file.
export async function write(info: Info, file = defaultFile()) {
  const tmp = `${file}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(info, null, 2), { mode: 0o600 })
  await fs.rename(tmp, file)
}

export async function remove(file = defaultFile()) {
  await fs.rm(file, { force: true })
}
