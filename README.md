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
git clone -b remote-control https://github.com/khanhnq1611/mrtoro.git && cd mrtoro
bun install
cd packages/opencode
bun run script/build.ts --single --skip-install
```

> Remote control lives on the `remote-control` branch until it is merged into `main`.

> `channel=latest` và `version=1.18.35` đã được hardcode làm default. Override bằng env var nếu cần: `OPENCODE_CHANNEL=... OPENCODE_VERSION=... bun run script/build.ts ...`

Binary output: `packages/opencode/dist/mrtoro-<os>-<arch>/bin/mrtoro` (e.g. `mrtoro-linux-x64`, `mrtoro-linux-arm64`)

Install it (a copy, since the next build wipes `dist/`):

```bash
install -m 755 dist/mrtoro-linux-x64/bin/mrtoro ~/.local/bin/mrtoro
```

Check it: `mrtoro --version` and `mrtoro remote-control --help`.

---

## Usage

```bash
mrtoro              # open TUI
mrtoro run "..."    # non-interactive, run a task
mrtoro --help       # all commands
```

Press `ctrl+p` inside the TUI to list available actions.

### Remote control

Drive mrtoro on your own machines from a browser or phone, Claude Code style. Your machine
connects out to a relay over a WebSocket, so it needs no open port or public IP; the relay serves
the web UI and forwards requests to it.

**1. Get an account.** Accounts are invite-only: ask the relay admin for an invite link, open it,
and pick a name and password.

**2. Link the machine** (once per machine; your provider must already be set up, see
[Configuration](#configuration)):

```bash
mrtoro remote-control login https://<relay>   # prints a code and a link: open it, sign in, approve
```

**3. Serve a directory:**

```bash
cd ~/my-project
mrtoro remote-control             # keep it running; prints this directory's web URL
mrtoro remote-control --auto      # also auto-approve tool permissions not explicitly denied (dangerous!)
mrtoro remote-control --name pc   # machine name shown in the web UI (default: hostname)
```

Or, inside the TUI, run `/remote-control` to share the running session: the TUI and the web then
see the same session, and running it again turns it off.

**4. Use it.** Open the relay in a browser, sign in, pick the machine and press **Open**, then
**New session**. Tool calls that need permission show Allow / Deny unless the machine runs `--auto`.
There is no terminal in the web UI.

```bash
mrtoro remote-control status   # relay, account, and this directory's environment
mrtoro remote-control logout   # unlink this machine (or revoke it from the web dashboard)
```

To keep a machine online, run it as a service, e.g. a systemd user unit:

```ini
# ~/.config/systemd/user/mrtoro-remote-control.service
[Service]
WorkingDirectory=%h/my-project
ExecStart=%h/.local/bin/mrtoro remote-control
Restart=on-failure
# exit status 1 = the relay refused this machine (revoked or logged out): log in again
RestartPreventExitStatus=1

[Install]
WantedBy=default.target
```

```bash
systemctl --user enable --now mrtoro-remote-control
sudo loginctl enable-linger $USER   # keep it running without a login session
```

The relay itself (accounts, web UI, invites) is a separate project, `mrtoro_relay`.

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
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "http://127.0.0.1:30005/v1"
      },
      "models": {
        "glm-5.3-nvfp4": { "name": "GLM 5.3" }
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
