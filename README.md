# mrtoro

Local AI coding agent. Fork of [opencode](https://github.com/anomalyco/opencode) with all cloud features removed — no accounts, no session sharing, no hosted models, no auto-update.

Runs entirely on your machine. Connects to any LLM provider via API key or a local OpenAI-compatible server.

---

## Features

- **Terminal UI** — full TUI built on SolidJS + opentui
- **All providers** — Anthropic, OpenAI, Google, xAI, Mistral, Cerebras, Groq, Ollama, and any OpenAI-compatible server
- **Gamma agent** — the primary coding agent; runs in a persistent session with full tool access
- **Subagents** — `general` and `explore` for delegated work
- **Built-in tools** — bash, read, edit, write, glob, grep, webfetch, websearch (Exa), LSP, formatters, MCP
- **Skills** — lazy-loaded Markdown knowledge files; `mrtoro-docs` ships built-in
- **Sessions** — stored locally in SQLite at `~/.local/share/mrtoro/`

---

## Installation

**1. Install Bun** (if not already installed):

```bash
curl -fsSL https://bun.sh/install | bash
```

**2. Clone and build:**

```bash
git clone https://github.com/khanhnq1611/mrtoro.git && cd mrtoro
bun install
cd packages/opencode
bun run script/build.ts --single --skip-install
```

> `channel=latest` và `version=1.18.35` đã được hardcode làm default. Override bằng env var nếu cần: `OPENCODE_CHANNEL=... OPENCODE_VERSION=... bun run script/build.ts ...`

Binary output: `packages/opencode/dist/mrtoro-linux-x64/bin/mrtoro`

Add to PATH:

```bash
ln -sf "$(pwd)/packages/opencode/dist/mrtoro-linux-x64/bin/mrtoro" ~/.local/bin/mrtoro
```

---

## Usage

```bash
mrtoro              # open TUI
mrtoro run "..."    # non-interactive, run a task
mrtoro --help       # all commands
```

Press `ctrl+p` inside the TUI to list available actions.

---

## Configuration

Global config: `~/.config/mrtoro/mrtoro.jsonc`

Minimal example with a local OpenAI-compatible server:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "etprovider": {
      "name": "Local GLM",
      "type": "openai-compatible",
      "options": {
        "baseURL": "http://127.0.0.1:30005/v1",
        "models": ["glm-5.3-nvfp4"]
      }
    }
  },
  "model": "etprovider/glm-5.3-nvfp4",
  "skills": {
    "paths": ["/path/to/mrtoro-docs"]
  }
}
```

Other providers (Anthropic, OpenAI, etc.) use the standard `apiKey` option. See `mrtoro-docs` skill for the full config reference.

---

## File locations

| Scope | Path |
|---|---|
| Global config | `~/.config/mrtoro/mrtoro.jsonc` |
| Global instructions | `~/.config/mrtoro/AGENTS.md` |
| Project config | `./mrtoro.json` or `.mrtoro/mrtoro.json` |
| Project agents | `.mrtoro/agents/<name>.md` |
| Sessions / DB | `~/.local/share/mrtoro/` |
| Logs / cache | `~/.cache/mrtoro/` |

Legacy `.opencode/` and `opencode.json` names are still read for compatibility.

---

## Repo structure

```
packages/
  core/        — providers, agents, DB, skills, plugin system (Effect)
  opencode/    — CLI, session loop, tools, TUI server
  tui/         — terminal UI (SolidJS + opentui)
  sdk/         — JS/TS SDK for headless use
  schema/      — shared types (Effect Schema)
mrtoro-docs/   — built-in documentation skill
```

---

## Based on

[opencode](https://github.com/anomalyco/opencode) by anomalyco — MIT license.
