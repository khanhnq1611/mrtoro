// Fierce buffalo (toro) head — the MrToro mascot. Rendered as a single column
// with a red→charcoal split gradient (see component/logo.tsx), so `left` holds
// the whole art and `right` is intentionally blank.
export const bull = [
  "   ▄██                            ██▄",
  "  ████                            ████",
  " █████                            █████",
  " ▀█████▄      ▄▄▄▄▄▄▄▄▄▄▄▄      ▄█████▀",
  "  ▀████████▄▄██████████████▄▄████████▀",
  "▄   ▀▀████████████████████████████▀▀   ▄",
  "████▄▄▀██████████████████████████▀▄▄████",
  " ▀█████ ███▀▀██████████████▀▀███ █████▀",
  "   ▀▀▀  ████▄▄ ▀▀██████▀▀ ▄▄████  ▀▀▀",
  "         ██████████████████████",
  "          ████████████████████",
  "           ████▀▀██████▀▀████",
  "           ▀███▄▄██████▄▄███▀",
  "              ▀▀████████▀▀",
]

// "TOROLAB", centered under the bull.
export const wordmark = [
  "   ▀█▀ █▀▀█ █▀▀▄ █▀▀█ █    █▀▀█ █▀▀▄",
  "    █  █  █ █▀▀▄ █  █ █    █▀▀█ █▀▀▄",
  "    ▀  ▀▀▀▀ ▀  ▀ ▀▀▀▀ ▀▀▀▀ ▀  ▀ ▀▀▀ ",
]

// A one-space spacer row keeps the bull from crowding the wordmark (an empty
// string would collapse to zero height in the TUI).
const art = [...bull, " ", ...wordmark]

export const logo = {
  left: art,
  right: art.map(() => ""),
}

export const go = {
  left: ["    ", "█▀▀▀", "█_^█", "▀▀▀▀"],
  right: ["    ", "█▀▀█", "█__█", "▀▀▀▀"],
}

export const marks = "_^~,"

// Shared logo palette: the left half glares red, the right half sits in shadow.
// The shadow stays a readable grey — near-black vanished on dark terminals and
// swallowed the bottom rows (the mouth).
export const SPLIT = 20
// The wordmark splits on the gap between its words: "TORO" red, "LAB" grey.
export const WORDMARK_SPLIT = 21
export const LIGHT: [number[], number[]] = [
  [255, 45, 70],
  [170, 0, 25],
]
export const DARK: [number[], number[]] = [
  [165, 165, 175],
  [110, 110, 120],
]
export const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
