export * as DefaultSkills from "./defaults"

import officeMedia from "./office-media.md" with { type: "text" }
import { ConfigMarkdown } from "../../config/markdown"

export type DefaultSkill = {
  name: string
  description: string
  content: string
}

function parse(text: string): DefaultSkill {
  const md = ConfigMarkdown.parse(text)
  const data = (md.data ?? {}) as Record<string, unknown>
  if (typeof data.name !== "string" || !data.name) throw new Error("default skill is missing a name")
  return {
    name: data.name,
    description: typeof data.description === "string" ? data.description : "",
    content: md.content,
  }
}

// Skills that ship with mrtoro and are available on every install. Registered
// before disk discovery so a user skill with the same name can override them.
export const skills: DefaultSkill[] = [parse(officeMedia)]
