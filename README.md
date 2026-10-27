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
- **Skills** — lazy-loaded Markdown knowledge files; the full mrtoro reference is the `mrtoro-docs/` skill in this repo (see [Configuration](#configuration))
- **Sessions** — stored locally in SQLite at `~/.local/share/mrtoro/`

---

## Installation

Linux on x86_64 (amd64) or aarch64 (arm64, e.g. Raspberry Pi), with `git`, `curl` and `unzip`:

```bash
curl -fsSL https://raw.githubusercontent.com/khanhnq1611/mrtoro/remote-control/install | bash && exec "$SHELL"
```

Then run `mrtoro` in the same terminal. The trailing `exec "$SHELL"` restarts your shell so it
picks up the new `PATH`: a piped script cannot change the environment of the terminal that ran it,
so sourcing `~/.bashrc` from inside the installer would not help.

The script:

- detects the CPU (x64, x64 without AVX2, or arm64) and builds the matching binary from source;
  there are no prebuilt releases, so the first run takes a few minutes;
- builds with the exact Bun version the repo pins, downloaded privately to
  `~/.local/share/mrtoro-bun` if your system Bun differs (your own Bun is not touched);
- keeps the source in `~/.local/share/mrtoro-src`;
- installs `mrtoro` into a writable directory that is already on your `PATH` (`~/.local/bin` or
  `~/bin` first). If none is, it uses `~/.local/bin` and adds it to your shell config
  (`.bashrc`, `.zshrc`, fish `config.fish`, or `.profile`).

Run the same command again to update. Options go after `bash -s --`:

```bash
curl -fsSL https://raw.githubusercontent.com/khanhnq1611/mrtoro/remote-control/install | bash -s -- --bin-dir ~/bin && exec "$SHELL"
#   --bin-dir <dir>    install the binary here
#   --branch <name>    build another branch (default: remote-control)
#   --src <dir>        keep the source elsewhere
#   --no-modify-path   never edit shell config files
```

Check it: `mrtoro --version`. Alpine and other musl systems are not supported.

<details>
<summary>Build by hand</summary>

```bash
curl -fsSL https://bun.sh/install | bash          # Bun; the repo pins the version in package.json
git clone -b remote-control https://github.com/khanhnq1611/mrtoro.git && cd mrtoro
bun install
cd packages/opencode
bun run script/build.ts --single --skip-install   # add --baseline on x64 CPUs without AVX2
install -m 755 dist/mrtoro-linux-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')/bin/mrtoro ~/.local/bin/mrtoro
```

Remote control lives on the `remote-control` branch. `channel=latest` and `version=1.18.35` are
the build defaults; override them with `OPENCODE_CHANNEL=... OPENCODE_VERSION=...`.

</details>

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
    "paths": ["~/.local/share/mrtoro-src/mrtoro-docs"]
  }
}
```

Other providers (Anthropic, OpenAI, etc.) use the standard `apiKey` option. See `mrtoro-docs` skill for the full config reference.

`mrtoro-docs` is not compiled into the binary: point `skills.paths` at the `mrtoro-docs/` folder
of the source checkout (the installer keeps it in `~/.local/share/mrtoro-src`), as above, so the agent can answer questions about configuring mrtoro.

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
mrtoro-docs/   — documentation skill (load it via skills.paths)
```

---

## Based on

[opencode](https://github.com/anomalyco/opencode) by anomalyco — MIT license.
