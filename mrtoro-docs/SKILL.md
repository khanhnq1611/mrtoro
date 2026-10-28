---
name: mrtoro-docs
description: Official mrtoro documentation. Use when the user asks about mrtoro itself — what it can do, how to configure it (mrtoro.json, agents, commands, tools, permissions, MCP servers, providers/models, keybinds, themes, plugins, skills, LSP, formatters), CLI usage, or troubleshooting. Read only the reference file(s) relevant to the question.
---

# mrtoro documentation

mrtoro is a local terminal AI coding agent based on opencode, with all cloud features removed. To answer a question, pick the relevant file(s) from the index below and read them with the read tool from the `reference/` folder next to this file. Long files (`providers.md`, `config.md`, `cli.md`, `agents.md`): grep for the heading first, then read only that section with offset/limit.

| File | Covers |
| --- | --- |
| `reference/intro.md` | What mrtoro is, starting it, adding a provider (incl. local OpenAI-compatible servers), file locations |
| `reference/config.md` | `mrtoro.json(c)` format, locations and precedence, every top-level option, variable substitution |
| `reference/config-schema.json` | Authoritative JSON Schema for `mrtoro.json` (start at `$defs.Config.properties`) |
| `reference/providers.md` | Setting up each LLM provider, credentials, base URLs, custom/OpenAI-compatible providers |
| `reference/models.md` | Choosing a model, model IDs, per-model options, variants, model loading order |
| `reference/agents.md` | Primary agents and subagents, built-ins (`gamma`, `general`, `explore`), defining agents in JSON/Markdown, agent options |
| `reference/commands.md` | Custom slash commands: Markdown/JSON definitions, arguments, shell output, file references |
| `reference/tools.md` | Built-in tools (bash, edit, read, grep, webfetch, …) and how to enable/disable them |
| `reference/custom-tools.md` | Writing your own tools in TS/JS (`@opencode-ai/plugin`) |
| `reference/permissions.md` | `permission` config: allow/ask/deny, patterns, auto mode, per-agent overrides |
| `reference/policies.md` | `experimental.policies` (not enforced yet in the current runtime; use `disabled_providers`/`enabled_providers` today) |
| `reference/mcp-servers.md` | Adding local and remote MCP servers, OAuth, per-agent MCP control |
| `reference/plugins.md` | Plugins: loading from files/npm, hooks, events, examples |
| `reference/skills.md` | Agent skills (`SKILL.md`): locations, frontmatter, permissions |
| `reference/rules.md` | `AGENTS.md` instructions (project and global), `instructions` config (CLAUDE.md is not read) |
| `reference/references.md` | `references` config: give mrtoro access to other local directories or git repos |
| `reference/lsp.md` | LSP servers: built-ins, enabling, custom servers |
| `reference/formatters.md` | Code formatters: built-ins, enabling, custom formatters |
| `reference/tui.md` | Using the TUI: `@` file refs, `!` bash, slash commands, editor setup, `tui.json`, attention |
| `reference/keybinds.md` | Keyboard shortcuts, leader key, customizing/disabling keybinds |
| `reference/themes.md` | Built-in themes and writing custom themes |
| `reference/cli.md` | All `mrtoro` CLI commands and flags (including `remote-control`: using mrtoro from a browser through a relay), environment variables (`MRTORO_*` / `OPENCODE_*`) |
| `reference/server.md` | `mrtoro serve` headless HTTP server, auth, OpenAPI endpoints |
| `reference/sdk.md` | JS/TS SDK (`@opencode-ai/sdk`) for controlling the server |
| `reference/acp.md` | Agent Client Protocol: using mrtoro from Zed, JetBrains, Neovim |
| `reference/ide.md` | Using mrtoro from VS Code/Cursor terminals and the IDE extension |
| `reference/network.md` | Proxies and custom CA certificates |
| `reference/windows-wsl.md` | Running mrtoro on Windows via WSL |
| `reference/troubleshooting.md` | Logs, storage locations, plugin/cache problems, common errors |

Key facts: the command is `mrtoro`; config files are `mrtoro.json`/`mrtoro.jsonc` (global in `~/.config/mrtoro/`), the project folder is `.mrtoro/`, and data lives in `~/.local/share/mrtoro/`. Legacy `opencode.json(c)`, `.opencode/` and `OPENCODE_*` names are still read. There are no hosted models, session sharing, accounts, web UI, desktop app, or auto-update.
