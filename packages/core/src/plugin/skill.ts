/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { define } from "./internal"
import { Effect } from "effect"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizeOpencodeContent from "./skill/customize-mrtoro.md" with { type: "text" }

export const CustomizeOpencodeContent = customizeOpencodeContent

export const Plugin = define({
  id: "skill",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.skill.transform((draft) => {
      draft.source(
        SkillV2.EmbeddedSource.make({
          type: "embedded",
          skill: SkillV2.Info.make({
            name: "customize-mrtoro",
            description:
              "Use ONLY when the user is editing or creating mrtoro's own configuration: mrtoro.json, mrtoro.jsonc, the legacy opencode.json/opencode.jsonc, files under .mrtoro/ or .opencode/, or files under ~/.config/mrtoro/. Also use when creating or fixing mrtoro agents, subagents, commands, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring mrtoro itself.",
            location: AbsolutePath.make("/builtin/customize-mrtoro.md"),
            content: CustomizeOpencodeContent,
          }),
        }),
      )
    })
  }),
})
