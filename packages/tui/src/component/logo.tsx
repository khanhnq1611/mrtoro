import { RGBA } from "@opentui/core"
import { For } from "solid-js"
import { DARK, LIGHT, SPLIT, WORDMARK_SPLIT, bull, lerp, logo } from "../logo"

const rgba = (c: number[]) => RGBA.fromInts(c[0], c[1], c[2], 255)

export function Logo() {
  const lines = logo.left
  const count = lines.length

  return (
    <box>
      <For each={lines}>
        {(line, index) => {
          const t = count > 1 ? index() / (count - 1) : 0
          const light = rgba(lerp(LIGHT[0], LIGHT[1], t))
          const dark = rgba(lerp(DARK[0], DARK[1], t))
          const split = index() < bull.length ? SPLIT : WORDMARK_SPLIT
          return (
            <box flexDirection="row">
              <For each={Array.from(line)}>
                {(char, charIndex) => (
                  <text fg={charIndex() < split ? light : dark} selectable={false}>
                    {char}
                  </text>
                )}
              </For>
            </box>
          )
        }}
      </For>
    </box>
  )
}
