import { EOL } from "os"
import { Schema } from "effect"
import { DARK, LIGHT, SPLIT, WORDMARK_SPLIT, bull, lerp, wordmark } from "./logo"

export class CancelledError extends Schema.TaggedErrorClass<CancelledError>()("UICancelledError", {}) {}

export const Style = {
  TEXT_HIGHLIGHT: "\x1b[96m",
  TEXT_HIGHLIGHT_BOLD: "\x1b[96m\x1b[1m",
  TEXT_DIM: "\x1b[90m",
  TEXT_DIM_BOLD: "\x1b[90m\x1b[1m",
  TEXT_NORMAL: "\x1b[0m",
  TEXT_NORMAL_BOLD: "\x1b[1m",
  TEXT_WARNING: "\x1b[93m",
  TEXT_WARNING_BOLD: "\x1b[93m\x1b[1m",
  TEXT_DANGER: "\x1b[91m",
  TEXT_DANGER_BOLD: "\x1b[91m\x1b[1m",
  TEXT_SUCCESS: "\x1b[92m",
  TEXT_SUCCESS_BOLD: "\x1b[92m\x1b[1m",
  TEXT_INFO: "\x1b[94m",
  TEXT_INFO_BOLD: "\x1b[94m\x1b[1m",
}

export function println(...message: string[]) {
  print(...message)
  process.stderr.write(EOL)
}

export function print(...message: string[]) {
  blank = false
  process.stderr.write(message.join(" "))
}

let blank = false
export function empty() {
  if (blank) return
  println("" + Style.TEXT_NORMAL)
  blank = true
}

export function logo(pad?: string) {
  const plain = !process.stdout.isTTY && !process.stderr.isTTY

  const reset = "\x1b[0m"
  const fg = (c: number[]) => `\x1b[38;2;${c[0]};${c[1]};${c[2]}m`

  const paint = (line: string, t: number, split: number) => {
    if (plain) return line
    const l = fg(lerp(LIGHT[0], LIGHT[1], t))
    const d = fg(lerp(DARK[0], DARK[1], t))
    const chars = [...line]
    return l + chars.slice(0, split).join("") + d + chars.slice(split).join("") + reset
  }

  const result: string[] = []
  const emit = (lines: string[], split: number) => {
    lines.forEach((line, index) => {
      if (pad) result.push(pad)
      result.push(paint(line, lines.length > 1 ? index / (lines.length - 1) : 0, split))
      result.push(EOL)
    })
  }
  emit(bull, SPLIT)
  result.push(EOL)
  emit(wordmark, WORDMARK_SPLIT)
  return result.join("").trimEnd()
}

export async function input(prompt: string): Promise<string> {
  const readline = require("readline")
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(prompt, (answer: string) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export function error(message: string) {
  if (message.startsWith("Error: ")) {
    message = message.slice("Error: ".length)
  }
  println(Style.TEXT_DANGER_BOLD + "Error: " + Style.TEXT_NORMAL + message)
}

export function markdown(text: string): string {
  return text
}

export * as UI from "./ui"
