import { DARK, LIGHT, WORDMARK_SPLIT, lerp, wordmark as glyphs } from "../logo"

const reset = "\x1b[0m"
const bold = "\x1b[1m"
const dim = "\x1b[90m"

const fg = (c: number[]) => `\x1b[38;2;${c[0]};${c[1]};${c[2]}m`

function wordmark(pad = "") {
  return glyphs.map((line, index) => {
    const t = glyphs.length > 1 ? index / (glyphs.length - 1) : 0
    const chars = [...line]
    return (
      pad +
      fg(lerp(LIGHT[0], LIGHT[1], t)) +
      chars.slice(0, WORDMARK_SPLIT).join("") +
      fg(lerp(DARK[0], DARK[1], t)) +
      chars.slice(WORDMARK_SPLIT).join("") +
      reset
    )
  })
}

export function sessionEpilogue(input: { title: string; sessionID?: string }) {
  const weak = (text: string) => `${dim}${text.padEnd(10, " ")}${reset}`
  return [
    ...wordmark(),
    "",
    `  ${weak("Session")}${bold}${input.title}${reset}`,
    `  ${weak("Continue")}${bold}mrtoro -s ${input.sessionID}${reset}`,
    "",
  ].join("\n")
}
