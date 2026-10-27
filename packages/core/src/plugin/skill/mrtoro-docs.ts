export * as MrtoroDocs from "./mrtoro-docs"

import fs from "fs"
import path from "path"
import { ConfigMarkdown } from "../../config/markdown"
import { Global } from "../../global"
import skill from "../../../../../mrtoro-docs/SKILL.md" with { type: "text" }
import acp from "../../../../../mrtoro-docs/reference/acp.md" with { type: "text" }
import agents from "../../../../../mrtoro-docs/reference/agents.md" with { type: "text" }
import cli from "../../../../../mrtoro-docs/reference/cli.md" with { type: "text" }
import commands from "../../../../../mrtoro-docs/reference/commands.md" with { type: "text" }
import configSchema from "../../../../../mrtoro-docs/reference/config-schema.json" with { type: "text" }
import config from "../../../../../mrtoro-docs/reference/config.md" with { type: "text" }
import customTools from "../../../../../mrtoro-docs/reference/custom-tools.md" with { type: "text" }
import formatters from "../../../../../mrtoro-docs/reference/formatters.md" with { type: "text" }
import ide from "../../../../../mrtoro-docs/reference/ide.md" with { type: "text" }
import intro from "../../../../../mrtoro-docs/reference/intro.md" with { type: "text" }
import keybinds from "../../../../../mrtoro-docs/reference/keybinds.md" with { type: "text" }
import lsp from "../../../../../mrtoro-docs/reference/lsp.md" with { type: "text" }
import mcpServers from "../../../../../mrtoro-docs/reference/mcp-servers.md" with { type: "text" }
import models from "../../../../../mrtoro-docs/reference/models.md" with { type: "text" }
import network from "../../../../../mrtoro-docs/reference/network.md" with { type: "text" }
import permissions from "../../../../../mrtoro-docs/reference/permissions.md" with { type: "text" }
import plugins from "../../../../../mrtoro-docs/reference/plugins.md" with { type: "text" }
import policies from "../../../../../mrtoro-docs/reference/policies.md" with { type: "text" }
import providers from "../../../../../mrtoro-docs/reference/providers.md" with { type: "text" }
import references from "../../../../../mrtoro-docs/reference/references.md" with { type: "text" }
import rules from "../../../../../mrtoro-docs/reference/rules.md" with { type: "text" }
import sdk from "../../../../../mrtoro-docs/reference/sdk.md" with { type: "text" }
import server from "../../../../../mrtoro-docs/reference/server.md" with { type: "text" }
import skills from "../../../../../mrtoro-docs/reference/skills.md" with { type: "text" }
import themes from "../../../../../mrtoro-docs/reference/themes.md" with { type: "text" }
import tools from "../../../../../mrtoro-docs/reference/tools.md" with { type: "text" }
import troubleshooting from "../../../../../mrtoro-docs/reference/troubleshooting.md" with { type: "text" }
import tui from "../../../../../mrtoro-docs/reference/tui.md" with { type: "text" }
import windowsWsl from "../../../../../mrtoro-docs/reference/windows-wsl.md" with { type: "text" }

// Every file in the repo's mrtoro-docs/ folder; a test fails when one is missing here.
export const files: Record<string, string> = {
  "SKILL.md": skill,
  "reference/acp.md": acp,
  "reference/agents.md": agents,
  "reference/cli.md": cli,
  "reference/commands.md": commands,
  // TypeScript types a .json import as the parsed object even with type: "text".
  "reference/config-schema.json": configSchema as unknown as string,
  "reference/config.md": config,
  "reference/custom-tools.md": customTools,
  "reference/formatters.md": formatters,
  "reference/ide.md": ide,
  "reference/intro.md": intro,
  "reference/keybinds.md": keybinds,
  "reference/lsp.md": lsp,
  "reference/mcp-servers.md": mcpServers,
  "reference/models.md": models,
  "reference/network.md": network,
  "reference/permissions.md": permissions,
  "reference/plugins.md": plugins,
  "reference/policies.md": policies,
  "reference/providers.md": providers,
  "reference/references.md": references,
  "reference/rules.md": rules,
  "reference/sdk.md": sdk,
  "reference/server.md": server,
  "reference/skills.md": skills,
  "reference/themes.md": themes,
  "reference/tools.md": tools,
  "reference/troubleshooting.md": troubleshooting,
  "reference/tui.md": tui,
  "reference/windows-wsl.md": windowsWsl,
}
const frontmatter = ConfigMarkdown.parse(skill)

export const description = String(frontmatter.data.description)
export const content = frontmatter.content

// The skill tells the model to read reference/*.md next to SKILL.md with the read
// tool, which cannot see inside the binary, so the folder is written to the cache
// on first use, one directory per docs version. Undefined when the cache is not
// writable: the skill still loads, without its reference files.
let extracted: string | undefined
export function location() {
  if (extracted) return extracted
  const dir = path.join(Global.Path.cache, "skills", `mrtoro-docs-${Bun.hash(JSON.stringify(files)).toString(36)}`)
  try {
    if (!fs.existsSync(dir)) extract(dir)
  } catch {
    return undefined
  }
  extracted = path.join(dir, "SKILL.md")
  return extracted
}

function extract(dir: string) {
  const staging = `${dir}.${process.pid}.tmp`
  Object.entries(files).forEach(([name, text]) => {
    fs.mkdirSync(path.dirname(path.join(staging, name)), { recursive: true })
    fs.writeFileSync(path.join(staging, name), text)
  })
  try {
    fs.renameSync(staging, dir)
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true })
    // Another mrtoro process finished first; its copy is identical.
    if (!fs.existsSync(dir)) throw error
  }
}
