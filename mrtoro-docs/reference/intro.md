# Introduction

What mrtoro is, how to start it, and how to connect a model.

mrtoro is a local AI coding agent that runs in your terminal. It is based on opencode, rebranded and stripped of all cloud features: there is no account login, no session sharing, no hosted model subscription, no web UI, no desktop app, and no self-update. Everything runs on your machine and talks only to the model providers you configure.

---

## Start mrtoro

Open a terminal in your project folder and run:

```bash
mrtoro
```

This opens the [TUI](tui.md) for the current directory. You can also pass a path (`mrtoro /path/to/project`), continue the last session with `mrtoro -c`, or resume a specific session with `mrtoro -s <session>`.

For non-interactive use, run a single prompt:

```bash
mrtoro run "Explain how the auth module works"
```

See the [CLI reference](cli.md) for all commands, including `mrtoro serve`, `mrtoro attach`, `mrtoro models`, `mrtoro auth login`, and `mrtoro mcp add`.

---

## Add a model provider

mrtoro has **no hosted or free models**. You must configure at least one provider before you can chat; otherwise mrtoro reports that no providers are available.

There are two ways to add one.

### With `/connect`

Inside the TUI, run:

```txt
/connect
```

Pick a provider (Anthropic, OpenAI, Google, OpenRouter, GitHub Copilot, Amazon Bedrock, and many more) and enter its API key or complete its login flow. Credentials are stored in `~/.local/share/mrtoro/auth.json`. You can do the same from the shell with `mrtoro auth login`.

Then select a model with `/models`.

### In the config file

Declare the provider in your global config, `~/.config/mrtoro/mrtoro.jsonc` (or in a project's `mrtoro.json`). This is how you use a local model server or any other OpenAI-compatible endpoint: set `"npm": "@ai-sdk/openai-compatible"` and point `options.baseURL` at the server.

```jsonc title="~/.config/mrtoro/mrtoro.jsonc"
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "local": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Local server",
      "options": {
        "baseURL": "http://127.0.0.1:8080/v1",
        // "apiKey": "{env:LOCAL_API_KEY}",
      },
      "models": {
        "my-model": {
          "name": "My local model",
          "limit": { "context": 128000, "output": 16384 },
        },
      },
    },
  },
  "model": "local/my-model",
}
```

The model ID format is `provider_id/model_id`. See [Providers](providers.md) (especially [Custom provider](providers.md#custom-provider)) and [Models](models.md) for details.

---

## Where things live

- Global config: `~/.config/mrtoro/mrtoro.json` or `mrtoro.jsonc` (TUI settings in `~/.config/mrtoro/tui.json`)
- Global instructions: `~/.config/mrtoro/AGENTS.md`
- Project config: `mrtoro.json(c)` in the project, plus a `.mrtoro/` folder for agents, commands, plugins, skills, tools, and themes
- Data (sessions, logs, credentials): `~/.local/share/mrtoro/`
- Cache: `~/.cache/mrtoro/`

Legacy opencode names are still read for compatibility: `opencode.json(c)` files, `.opencode/` folders, and `OPENCODE_*` environment variables. The `MRTORO_*` form of an environment variable (for example `MRTORO_CONFIG`) is preferred and wins when both are set.

---

## Next steps

- Customize behavior with [config](config.md), [agents](agents.md), [commands](commands.md), and [rules](rules.md).
- Control what the agent may do with [permissions](permissions.md).
- Extend it with [MCP servers](mcp-servers.md), [custom tools](custom-tools.md), [skills](skills.md), and [plugins](plugins.md).
