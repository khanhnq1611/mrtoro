# Config

Using the mrtoro JSON config.

You can configure mrtoro using a JSON config file.

---

## Format

mrtoro supports both **JSON** and **JSONC** (JSON with Comments) formats.

```jsonc title="mrtoro.jsonc"
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "server": {
    "port": 4096,
  },
}
```

---

## Locations

You can place your config in a couple of different locations and they have a
different order of precedence.

> **Note:**
> The legacy names from opencode are still read for compatibility: `opencode.json` / `opencode.jsonc` files and `.opencode/` project folders are loaded alongside `mrtoro.json` / `mrtoro.jsonc` and `.mrtoro/`. New files should use the `mrtoro` names.

> **Note:**
> Configuration files are **merged together**, not replaced.

Configuration files are merged together, not replaced. Settings from the following config locations are combined. Later configs override earlier ones only for conflicting keys. Non-conflicting settings from all configs are preserved.

For example, if your global config sets `snapshot: false` and your project config sets `model: "anthropic/claude-sonnet-4-5"`, the final configuration will include both settings.

---

### Precedence order

Config sources are loaded in this order (later sources override earlier ones):

1. **Remote config** (from the `.well-known/opencode` endpoint; the path keeps its legacy name) - organizational defaults
2. **Global config** (`~/.config/mrtoro/mrtoro.json`) - user preferences
3. **Custom config** (`MRTORO_CONFIG` or legacy `OPENCODE_CONFIG` env var) - custom overrides
4. **Project config** (`mrtoro.json` in project) - project-specific settings
5. **`.mrtoro` directories** - agents, commands, plugins
6. **Inline config** (`MRTORO_CONFIG_CONTENT` or legacy `OPENCODE_CONFIG_CONTENT` env var) - runtime overrides
7. **Managed config files** (`/Library/Application Support/mrtoro/` on macOS) - admin-controlled
8. **macOS managed preferences** (`.mobileconfig` via MDM) - highest priority, not user-overridable

This means project configs can override global defaults, and global configs can override remote organizational defaults. Managed settings override everything.

> **Note:**
> The `.mrtoro` and `~/.config/mrtoro` directories use **plural names** for subdirectories: `agents/`, `commands/`, `modes/`, `plugins/`, `skills/`, `tools/`, and `themes/`. Singular names (e.g., `agent/`) are also supported for backwards compatibility.

---

### Remote

Organizations can provide default configuration via the `.well-known/opencode` endpoint (legacy path name, unchanged in mrtoro). This is fetched automatically when you authenticate with a provider that supports it.

Remote config is loaded first, serving as the base layer. All other config sources (global, project) can override these defaults.

For example, if your organization provides MCP servers that are disabled by default:

```json title="Remote config from .well-known/opencode"
{
  "mcp": {
    "jira": {
      "type": "remote",
      "url": "https://jira.example.com/mcp",
      "enabled": false
    }
  }
}
```

You can enable specific servers in your local config:

```json title="mrtoro.json"
{
  "mcp": {
    "jira": {
      "type": "remote",
      "url": "https://jira.example.com/mcp",
      "enabled": true
    }
  }
}
```

---

### Global

Place your global mrtoro config in `~/.config/mrtoro/mrtoro.json`. Use global config for user-wide server/runtime preferences like providers, models, and permissions.

For TUI-specific settings, use `~/.config/mrtoro/tui.json`.

Global config overrides remote organizational defaults.

---

### Per project

Add `mrtoro.json` in your project root. Project config has the highest precedence among standard config files - it overrides both global and remote configs.

For project-specific TUI settings, add `tui.json` alongside it.

> **Tip:**
> Place project specific config in the root of your project.

When mrtoro starts up, it first looks for a config file in the current directory, then traverses up to the nearest Git directory.

This is also safe to be checked into Git and uses the same schema as the global one.

---

### Custom path

Specify a custom config file path using the `MRTORO_CONFIG` environment variable (the legacy `OPENCODE_CONFIG` is also accepted).

```bash
export MRTORO_CONFIG=/path/to/my/custom-config.json
mrtoro run "Hello world"
```

Custom config is loaded between global and project configs in the precedence order.

---

### Custom directory

Specify a custom config directory using the `MRTORO_CONFIG_DIR` (or legacy `OPENCODE_CONFIG_DIR`)
environment variable. This directory will be searched for agents, commands,
modes, and plugins just like the standard `.mrtoro` directory, and should
follow the same structure.

```bash
export MRTORO_CONFIG_DIR=/path/to/my/config-directory
mrtoro run "Hello world"
```

The custom directory is loaded after the global config and `.mrtoro` directories, so it **can override** their settings.

---

### Managed settings

Organizations can enforce configuration that users cannot override. Managed settings are loaded at the highest priority tier.

#### File-based

Drop an `mrtoro.json` or `mrtoro.jsonc` file in the system managed config directory:

| Platform | Path                                     |
| -------- | ---------------------------------------- |
| macOS    | `/Library/Application Support/mrtoro/` |
| Linux    | `/etc/mrtoro/`                         |
| Windows  | `%ProgramData%\mrtoro`                 |

These directories require admin/root access to write, so users cannot modify them.

#### macOS managed preferences

On macOS, mrtoro reads managed preferences from the `ai.opencode.managed` preference domain (this identifier keeps its legacy opencode name). Deploy a `.mobileconfig` via MDM (Jamf, Kandji, FleetDM) and the settings are enforced automatically.

mrtoro checks these paths:

1. `/Library/Managed Preferences/<user>/ai.opencode.managed.plist`
2. `/Library/Managed Preferences/ai.opencode.managed.plist`

The plist keys map directly to `mrtoro.json` fields. MDM metadata keys (`PayloadUUID`, `PayloadType`, etc.) are stripped automatically.

**Creating a `.mobileconfig`**

Use the `ai.opencode.managed` PayloadType. The mrtoro config keys go directly in the payload dict:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>ai.opencode.managed</string>
      <key>PayloadIdentifier</key>
      <string>com.example.mrtoro.config</string>
      <key>PayloadUUID</key>
      <string>GENERATE-YOUR-OWN-UUID</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>server</key>
      <dict>
        <key>hostname</key>
        <string>127.0.0.1</string>
      </dict>
      <key>permission</key>
      <dict>
        <key>*</key>
        <string>ask</string>
        <key>bash</key>
        <dict>
          <key>*</key>
          <string>ask</string>
          <key>rm -rf *</key>
          <string>deny</string>
        </dict>
      </dict>
    </dict>
  </array>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadIdentifier</key>
  <string>com.example.mrtoro</string>
  <key>PayloadUUID</key>
  <string>GENERATE-YOUR-OWN-UUID</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
```

Generate unique UUIDs with `uuidgen`. Customize the settings to match your organization's requirements.

**Deploying via MDM**

- **Jamf Pro:** Computers > Configuration Profiles > Upload > scope to target devices or smart groups
- **FleetDM:** Add the `.mobileconfig` to your gitops repo under `mdm.macos_settings.custom_settings` and run `fleetctl apply`

**Verifying on a device**

Double-click the `.mobileconfig` to install locally for testing (shows in System Settings > Privacy & Security > Profiles), then run:

```bash
mrtoro debug config
```

All managed preference keys appear in the resolved config and cannot be overridden by user or project configuration.

---

## Schema

The authoritative server/runtime config schema is bundled with this documentation as [`config-schema.json`](config-schema.json). JSON examples use `"$schema": "https://opencode.ai/config.json"` (and `"https://opencode.ai/tui.json"` for `tui.json`) only so that editors can offer validation and autocomplete; you never need to visit those URLs.

> **Note:**
> The schema still lists a few keys inherited from opencode that have no effect in mrtoro: `share`, `autoshare`, `autoupdate`, and `enterprise`.

---

### TUI

Use a dedicated `tui.json` (or `tui.jsonc`) file for TUI-specific settings.

```json title="tui.json"
{
  "$schema": "https://opencode.ai/tui.json",
  "scroll_speed": 3,
  "scroll_acceleration": {
    "enabled": true
  },
  "diff_style": "auto",
  "cursor": {
    "style": "block",
    "blinking": true
  },
  "mouse": true,
  "attention": {
    "enabled": true,
    "notifications": true,
    "sound": true,
    "volume": 0.4
  }
}
```

Use `MRTORO_TUI_CONFIG` (or legacy `OPENCODE_TUI_CONFIG`) to point to a custom TUI config file.

When `cursor.style` is `"default"`, the terminal default cursor is restored, so `cursor.blinking` has no effect.

Set `attention.enabled` to turn on TUI desktop notifications and sounds. See [TUI attention](tui.md#attention).

Legacy `theme`, `keybinds`, and `tui` keys in `mrtoro.json` are deprecated and automatically migrated when possible.

---

### Server

You can configure server settings for the `mrtoro serve` command (and the server started by the TUI) through the `server` option.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "server": {
    "port": 4096,
    "hostname": "0.0.0.0",
    "mdns": true,
    "mdnsDomain": "myproject.local",
    "cors": ["http://localhost:5173"]
  }
}
```

Available options:

- `port` - Port to listen on.
- `hostname` - Hostname to listen on. When `mdns` is enabled and no hostname is set, defaults to `0.0.0.0`.
- `mdns` - Enable mDNS service discovery. This allows other devices on the network to discover your mrtoro server.
- `mdnsDomain` - Custom domain name for mDNS service. Defaults to `mrtoro.local`. Useful for running multiple instances on the same network.
- `cors` - Additional origins to allow for CORS when using the HTTP server from a browser-based client. Values must be full origins (scheme + host + optional port), eg `https://app.example.com`.

[Learn more about the server here](server.md).

---

### Shell

You can configure the shell used for the interactive terminal using the `shell` option. Compatible shells are also used for agent tool calls.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "shell": "pwsh"
}
```

If not specified, mrtoro will automatically discover and use a sensible default based on your operating system (e.g. `pwsh` or `cmd.exe` on Windows, `/bin/zsh` or `/bin/bash` on macOS/Linux). You can provide an absolute path or a short name.

---

### Tools

You can manage the tools an LLM can use through the `tools` option.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "tools": {
    "write": false,
    "bash": false
  }
}
```

[Learn more about tools here](tools.md).

---

### Models

You can configure the providers and models you want to use in your mrtoro config through the `provider`, `model` and `small_model` options.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {},
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "anthropic/claude-haiku-4-5"
}
```

The `small_model` option configures a separate model for lightweight tasks like title generation. By default, mrtoro tries to use a cheaper model if one is available from your provider, otherwise it falls back to your main model.

Provider options can include `timeout`, `headerTimeout`, `chunkTimeout`, and `setCacheKey`:

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": {
      "options": {
        "timeout": 600000,
        "chunkTimeout": 30000,
        "setCacheKey": true
      }
    }
  }
}
```

- `timeout` - Request timeout in milliseconds (default: 300000). Set to `false` to disable.
- `headerTimeout` - Timeout in milliseconds to wait for response headers (default: 300000, or 5 minutes). This timer stops once headers arrive and does not limit the streamed response body. Set to `false` to disable.
- `chunkTimeout` - Timeout in milliseconds between streamed response chunks (default: 300000, or 5 minutes). If no chunk arrives in time, the request is aborted. Set to `false` to disable.
- `setCacheKey` - Ensure a cache key is always set for designated provider.

You can also configure [local models](models.md#local). [Learn more](models.md).

---

### Policies

Use the `experimental.policies` option to allow or deny mrtoro actions on configured resources. Currently, policies can control which providers mrtoro may use.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "experimental": {
    "policies": [
      {
        "effect": "deny",
        "action": "provider.use",
        "resource": "openai"
      }
    ]
  }
}
```

[Learn more about policies here](policies.md).

---

### Image attachments

mrtoro normalizes image attachments before sending them to the model. By default, images are resized when they exceed `2000x2000` pixels or `5242880` base64 bytes.

Configure image attachment limits with the `attachment.image` option:

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "attachment": {
    "image": {
      "auto_resize": true,
      "max_width": 2000,
      "max_height": 2000,
      "max_base64_bytes": 5242880
    }
  }
}
```

- `auto_resize` - Resize images that exceed the configured limits before provider requests. Set to `false` to reject oversized images instead.
- `max_width` - Maximum image width in pixels before resizing or rejection.
- `max_height` - Maximum image height in pixels before resizing or rejection.
- `max_base64_bytes` - Maximum encoded image payload size. This is the base64 payload size, not the original file size.

If an image still cannot fit after resizing, mrtoro omits oversized tool-result images or fails oversized user-provided images with an image size error.

---

#### Provider-Specific Options

Some providers support additional configuration options beyond the generic `timeout` and `apiKey` settings.

##### Amazon Bedrock

Amazon Bedrock supports AWS-specific configuration:

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "amazon-bedrock": {
      "options": {
        "region": "us-east-1",
        "profile": "my-aws-profile",
        "endpoint": "https://bedrock-runtime.us-east-1.vpce-xxxxx.amazonaws.com"
      }
    }
  }
}
```

- `region` - AWS region for Bedrock (defaults to `AWS_REGION` env var or `us-east-1`)
- `profile` - AWS named profile from `~/.aws/credentials` (defaults to `AWS_PROFILE` env var)
- `endpoint` - Custom endpoint URL for VPC endpoints. This is an alias for the generic `baseURL` option using AWS-specific terminology. If both are specified, `endpoint` takes precedence.

> **Note:**
> Bearer tokens (`AWS_BEARER_TOKEN_BEDROCK` or `/connect`) take precedence over profile-based authentication. See [authentication precedence](providers.md#authentication-precedence) for details.

[Learn more about Amazon Bedrock configuration](providers.md#amazon-bedrock).

---

### Themes

Set your UI theme in `tui.json`.

```json title="tui.json"
{
  "$schema": "https://opencode.ai/tui.json",
  "theme": "tokyonight"
}
```

[Learn more here](themes.md).

---

### Agents

You can configure specialized agents for specific tasks through the `agent` option.

```jsonc title="mrtoro.jsonc"
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "code-reviewer": {
      "description": "Reviews code for best practices and potential issues",
      "model": "anthropic/claude-sonnet-4-5",
      "prompt": "You are a code reviewer. Focus on security, performance, and maintainability.",
      "tools": {
        // Disable file modification tools for review-only agent
        "write": false,
        "edit": false,
      },
    },
  },
}
```

You can also define agents using markdown files in `~/.config/mrtoro/agents/` or `.mrtoro/agents/`. [Learn more here](agents.md).

---

### Default agent

You can set the default agent using the `default_agent` option. This determines which agent is used when none is explicitly specified.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "planner"
}
```

The default agent must be a primary agent (not a subagent). This can be the built-in `"gamma"` agent or a [custom primary agent](agents.md) you've defined (for example `"planner"`). If the specified agent doesn't exist or is a subagent, mrtoro will fall back to `"gamma"` with a warning.

This setting applies across all interfaces: TUI, CLI (`mrtoro run`), and the HTTP server / SDK.

---

### Subagent depth

You can control how deeply subagents can invoke other subagents using the `subagent_depth` option.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "subagent_depth": 2
}
```

The default is `1`, which allows primary agents to launch subagents but prevents those subagents from launching additional subagents. Set it to `2` to allow one additional level of nested subagents, or `0` to prevent all subagent launches.

---

### Commands

You can configure custom commands for repetitive tasks through the `command` option.

```jsonc title="mrtoro.jsonc"
{
  "$schema": "https://opencode.ai/config.json",
  "command": {
    "test": {
      "template": "Run the full test suite with coverage report and show any failures.\nFocus on the failing tests and suggest fixes.",
      "description": "Run tests with coverage",
      "agent": "gamma",
      "model": "anthropic/claude-haiku-4-5",
    },
    "component": {
      "template": "Create a new React component named $ARGUMENTS with TypeScript support.\nInclude proper typing and basic structure.",
      "description": "Create a new component",
    },
  },
}
```

You can also define commands using markdown files in `~/.config/mrtoro/commands/` or `.mrtoro/commands/`. [Learn more here](commands.md).

---

### Keybinds

Customize TUI keyboard shortcuts in `tui.json` with `keybinds`.

```json title="tui.json"
{
  "$schema": "https://opencode.ai/tui.json",
  "keybinds": {
    "command_list": "ctrl+p"
  }
}
```

`keybinds` is merged with built-in defaults, so you only need to configure the shortcuts you want to change.

[Learn more here](keybinds.md).

---

### Snapshot

mrtoro uses snapshots to track file changes during agent operations, enabling you to undo and revert changes within a session. Snapshots are enabled by default.

For large repositories or projects with many submodules, the snapshot system can cause slow indexing and significant disk usage as it tracks all changes using an internal git repository. You can disable snapshots using the `snapshot` option.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "snapshot": false
}
```

Note that disabling snapshots means changes made by the agent cannot be rolled back through the UI.

---

### Formatters

You can enable and configure code formatters through the `formatter` option. Omit it to keep formatters disabled.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "formatter": true
}
```

Use an object to keep built-ins enabled while configuring overrides or custom formatters.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "formatter": {
    "prettier": {
      "disabled": true
    },
    "custom-prettier": {
      "command": ["npx", "prettier", "--write", "$FILE"],
      "environment": {
        "NODE_ENV": "development"
      },
      "extensions": [".js", ".ts", ".jsx", ".tsx"]
    }
  }
}
```

[Learn more about formatters here](formatters.md).

---

### LSP Servers

You can enable and configure LSP servers through the `lsp` option. Omit it to keep LSP disabled.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "lsp": true
}
```

Use an object to keep built-ins enabled while configuring overrides or custom LSP servers.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "lsp": {
    "typescript": {
      "disabled": true
    }
  }
}
```

[Learn more about LSP servers here](lsp.md).

---

### Permissions

By default, mrtoro **allows all operations** without requiring explicit approval. You can change this using the `permission` option.

For example, to ensure that the `edit` and `bash` tools require user approval:

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "edit": "ask",
    "bash": "ask"
  }
}
```

[Learn more about permissions here](permissions.md).

---

### Compaction

You can control context compaction behavior through the `compaction` option.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "compaction": {
    "auto": true,
    "prune": false,
    "reserved": 10000
  }
}
```

- `auto` - Automatically compact the session when context is full (default: `true`).
- `prune` - Remove old tool outputs to save tokens (default: `false`). Set to `true` to enable pruning.
- `reserved` - Token buffer for compaction. Leaves enough window to avoid overflow during compaction.

---

### Watcher

You can configure file watcher ignore patterns through the `watcher` option.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "watcher": {
    "ignore": ["node_modules/**", "dist/**", ".git/**"]
  }
}
```

Patterns follow glob syntax. Use this to exclude noisy directories from file watching.

---

### MCP servers

You can configure MCP servers you want to use through the `mcp` option.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {}
}
```

[Learn more here](mcp-servers.md).

---

### Plugins

[Plugins](plugins.md) extend mrtoro with custom tools, hooks, and integrations.

Place plugin files in `.mrtoro/plugins/` or `~/.config/mrtoro/plugins/`. You can also load plugins from npm through the `plugin` option.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-helicone-session", "@my-org/custom-plugin"]
}
```

[Learn more here](plugins.md).

---

### Instructions

You can configure the instructions for the model you're using through the `instructions` option.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["CONTRIBUTING.md", "docs/guidelines.md", ".cursor/rules/*.md"]
}
```

This takes an array of paths and glob patterns to instruction files. [Learn more
about rules here](rules.md).

---

### Disabled providers

You can disable providers that are loaded automatically through the `disabled_providers` option. This is useful when you want to prevent certain providers from being loaded even if their credentials are available.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "disabled_providers": ["openai", "gemini"]
}
```

> **Note:**
> The `disabled_providers` takes priority over `enabled_providers`.

The `disabled_providers` option accepts an array of provider IDs. When a provider is disabled:

- It won't be loaded even if environment variables are set.
- It won't be loaded even if API keys are configured through the `/connect` command.
- The provider's models won't appear in the model selection list.

---

### Enabled providers

You can specify an allowlist of providers through the `enabled_providers` option. When set, only the specified providers will be enabled and all others will be ignored.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "enabled_providers": ["anthropic", "openai"]
}
```

This is useful when you want to restrict mrtoro to only use specific providers rather than disabling them one by one.

> **Note:**
> The `disabled_providers` takes priority over `enabled_providers`.

If a provider appears in both `enabled_providers` and `disabled_providers`, the `disabled_providers` takes priority for backwards compatibility.

---

### Experimental

The `experimental` key contains options that are under active development.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "experimental": {}
}
```

> **Caution:**
> Experimental options are not stable. They may change or be removed without notice.

---

## Variables

You can use variable substitution in your config files to reference environment variables and file contents.

---

### Env vars

Use `{env:VARIABLE_NAME}` to substitute environment variables:

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "model": "{env:OPENCODE_MODEL}",
  "provider": {
    "anthropic": {
      "models": {},
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}"
      }
    }
  }
}
```

If the environment variable is not set, it will be replaced with an empty string.

---

### Files

Use `{file:path/to/file}` to substitute the contents of a file:

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["./custom-instructions.md"],
  "provider": {
    "openai": {
      "options": {
        "apiKey": "{file:~/.secrets/openai-key}"
      }
    }
  }
}
```

File paths can be:

- Relative to the config file directory
- Or absolute paths starting with `/` or `~`

These are useful for:

- Keeping sensitive data like API keys in separate files.
- Including large instruction files without cluttering your config.
- Sharing common configuration snippets across multiple config files.
