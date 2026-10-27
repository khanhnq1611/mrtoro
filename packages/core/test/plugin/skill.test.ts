import { describe, expect } from "bun:test"
import { existsSync } from "fs"
import path from "path"
import { Effect } from "effect"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { SkillPlugin } from "@opencode-ai/core/plugin/skill"
import { MrtoroDocs } from "@opencode-ai/core/plugin/skill/mrtoro-docs"
import { SkillV2 } from "@opencode-ai/core/skill"
import { testEffect } from "../lib/effect"
import { host } from "./host"

const it = testEffect(AppNodeBuilder.build(SkillV2.node))

describe("SkillPlugin.Plugin", () => {
  it.effect("registers the built-in customize-mrtoro skill", () =>
    Effect.gen(function* () {
      const skill = yield* SkillV2.Service
      yield* SkillPlugin.Plugin.effect(host({ skill: { ...skill, reload: skill.reload } }))

      expect(yield* skill.list()).toContainEqual(
        expect.objectContaining({
          name: "customize-mrtoro",
          description: expect.stringContaining("mrtoro's own configuration"),
        }),
      )
    }),
  )

  it.effect("registers mrtoro-docs at a real SKILL.md with its reference folder", () =>
    Effect.gen(function* () {
      const skill = yield* SkillV2.Service
      yield* SkillPlugin.Plugin.effect(host({ skill: { ...skill, reload: skill.reload } }))

      const docs = (yield* skill.list()).find((item) => item.name === "mrtoro-docs")
      expect(docs?.description).toContain("Official mrtoro documentation")
      expect(docs?.location).toEndWith("/SKILL.md")
      expect(existsSync(path.join(path.dirname(docs?.location ?? ""), "reference", "providers.md"))).toBe(true)
    }),
  )

  it.effect("embeds every file of the repo's mrtoro-docs folder", () =>
    Effect.sync(() => {
      const root = path.resolve(import.meta.dir, "../../../../mrtoro-docs")
      expect(Object.keys(MrtoroDocs.files).toSorted()).toEqual(
        Array.from(new Bun.Glob("**/*").scanSync({ cwd: root })).toSorted(),
      )
    }),
  )
})
