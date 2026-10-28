import { createUniqueId, type ComponentProps } from "solid-js"

// mrtoro: the torolab artwork, i.e. the bull and wordmark of the TUI banner
// (packages/tui/src/logo.ts), drawn as pixels: █ fills a cell and ▀ / ▄ its top
// / bottom half, so a cell is one unit wide and two tall. As in the TUI, columns
// left of the split glow red and the rest sit in grey.
const BULL = [
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
const WORDMARK = [
  "   ▀█▀ █▀▀█ █▀▀▄ █▀▀█ █    █▀▀█ █▀▀▄",
  "    █  █  █ █▀▀▄ █  █ █    █▀▀█ █▀▀▄",
  "    ▀  ▀▀▀▀ ▀  ▀ ▀▀▀▀ ▀▀▀▀ ▀  ▀ ▀▀▀ ",
]
const BULL_SPLIT = 20
const WORDMARK_SPLIT = 21
// In the banner the wordmark sits one blank row under the bull, as in the TUI.
const BANNER_WORDMARK_ROW = BULL.length + 1

// One rectangle per horizontal run of lit half-cells within columns [from, to),
// with the art's first line drawn at text row `row`.
function pixelPath(lines: string[], from: number, to: number, row = 0) {
  return lines
    .flatMap((line, index) =>
      [0, 1].flatMap((half) => {
        const lit = Array.from({ length: to - from }, (_, column) => {
          const char = line[from + column] ?? " "
          return char === "█" || char === (half === 0 ? "▀" : "▄")
        })
        return lit.flatMap((on, column) => {
          if (!on || lit[column - 1]) return []
          const end = lit.indexOf(false, column)
          const x = from + column
          return [`M${x} ${(row + index) * 2 + half}h${(end === -1 ? lit.length : end) - column}v1H${x}z`]
        })
      }),
    )
    .join("")
}

const BULL_RED = pixelPath(BULL, 0, BULL_SPLIT)
const BULL_GREY = pixelPath(BULL, BULL_SPLIT, 40)
const WORDMARK_RED = pixelPath(WORDMARK, 0, WORDMARK_SPLIT)
const WORDMARK_GREY = pixelPath(WORDMARK, WORDMARK_SPLIT, 40)
const BANNER_WORDMARK_RED = pixelPath(WORDMARK, 0, WORDMARK_SPLIT, BANNER_WORDMARK_ROW)
const BANNER_WORDMARK_GREY = pixelPath(WORDMARK, WORDMARK_SPLIT, 40, BANNER_WORDMARK_ROW)

// Both halves darken from top to bottom, like the TUI's per-row gradient.
function Gradients(props: { red: string; grey: string; height: number }) {
  return (
    <defs>
      <linearGradient id={props.red} x1="0" y1="0" x2="0" y2={props.height} gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#ff2d46" />
        <stop offset="1" stop-color="#aa0019" />
      </linearGradient>
      <linearGradient id={props.grey} x1="0" y1="0" x2="0" y2={props.height} gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#a5a5af" />
        <stop offset="1" stop-color="#6e6e78" />
      </linearGradient>
    </defs>
  )
}

function Bull(props: { component: string; class?: string; ref?: ComponentProps<"svg">["ref"] }) {
  const red = createUniqueId()
  const grey = createUniqueId()
  return (
    <svg
      ref={props.ref}
      data-component={props.component}
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 40 28"
      shape-rendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Gradients red={red} grey={grey} height={28} />
      <path d={BULL_RED} fill={`url(#${red})`} />
      <path d={BULL_GREY} fill={`url(#${grey})`} />
    </svg>
  )
}

export const Mark = (props: { class?: string }) => <Bull component="logo-mark" class={props.class} />

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => (
  <Bull component="logo-splash" class={props.class} ref={props.ref} />
)

export const Logo = (props: { class?: string }) => {
  const red = createUniqueId()
  const grey = createUniqueId()
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="3 0 33 6"
      shape-rendering="crispEdges"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <Gradients red={red} grey={grey} height={6} />
      <path d={WORDMARK_RED} fill={`url(#${red})`} />
      <path d={WORDMARK_GREY} fill={`url(#${grey})`} />
    </svg>
  )
}

// The whole TUI banner: the bull above the wordmark.
export const Banner = (props: { class?: string }) => {
  const red = createUniqueId()
  const grey = createUniqueId()
  return (
    <svg
      data-component="logo-banner"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 36"
      shape-rendering="crispEdges"
      classList={{ [props.class ?? ""]: !!props.class }}
      role="img"
      aria-label="torolab"
    >
      <Gradients red={red} grey={grey} height={36} />
      <path d={BULL_RED + BANNER_WORDMARK_RED} fill={`url(#${red})`} />
      <path d={BULL_GREY + BANNER_WORDMARK_GREY} fill={`url(#${grey})`} />
    </svg>
  )
}
