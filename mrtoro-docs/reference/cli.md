# CLI

mrtoro CLI options and commands.

The mrtoro CLI by default starts the [TUI](tui.md) when run without any arguments.

```bash
mrtoro
```

But it also accepts commands as documented on this page. This allows you to interact with mrtoro programmatically.

```bash
mrtoro run "Explain how closures work in JavaScript"
```

---

### tui

Start the mrtoro terminal user interface.

```bash
mrtoro [project]
```

#### Flags

| Flag                                        | Short | Description                                                             |
| ------------------------------------------- | ----- | ----------------------------------------------------------------------- |
| `--continue`    | `-c`  | Continue the last session                                               |
| `--session`     | `-s`  | Session ID to continue                                                  |
| `--fork`        |       | Fork the session when continuing (use with `--continue` or `--session`) |
| `--prompt`      |       | Prompt to use                                                           |
| `--model`       | `-m`  | Model to use in the form of provider/model                              |
| `--agent`       |       | Agent to use                                                            |
| `--auto`        |       | Auto-approve permissions that are not explicitly denied                 |
| `--port`        |       | Port to listen on                                                       |
| `--hostname`    |       | Hostname to listen on                                                   |
| `--mdns`        |       | Enable mDNS discovery                                                   |
| `--mdns-domain` |       | Custom mDNS domain name                                                 |
| `--cors`        |       | Additional browser origin(s) to allow CORS                              |

---

## Commands

The mrtoro CLI also has the following commands.

---

### agent

Manage agents for mrtoro.

```bash
mrtoro agent [command]
```

---

#### create

Create a new agent with custom configuration.

```bash
mrtoro agent create
```

This command will guide you through creating a new agent with a custom system prompt and permission configuration. Anything you don't allow is denied in the generated agent's frontmatter.

#### Flags

| Flag                                        | Short | Description                                                                                                                                                                                                                |
| ------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--path`        |       | Directory to write the agent file to (defaults to global or `.mrtoro/agent` based on the prompt)                                                                                                                         |
| `--description` |       | What the agent should do                                                                                                                                                                                                   |
| `--mode`        |       | Agent mode: `all`, `primary`, or `subagent`                                                                                                                                                                                |
| `--permissions` |       | Comma-separated list of permissions to allow (default: all). Available: `bash`, `read`, `edit`, `glob`, `grep`, `webfetch`, `task`, `todowrite`, `websearch`, `lsp`, `skill`. Anything omitted is denied. Alias: `--tools` |
| `--model`       | `-m`  | Model to use, in `provider/model` format                                                                                                                                                                                   |

Passing all of `--path`, `--description`, `--mode`, and `--permissions` runs the command non-interactively.

---

#### list

List all available agents.

```bash
mrtoro agent list
```

---

### attach

Attach a terminal to an already running mrtoro backend server started via the `serve` command.

```bash
mrtoro attach [url]
```

This allows using the TUI with a remote mrtoro backend. For example:

```bash
# Start the backend server
mrtoro serve --port 4096 --hostname 0.0.0.0

# In another terminal, attach the TUI to the running backend
mrtoro attach http://10.20.30.40:4096
```

#### Flags

| Flag                                     | Short | Description                                                                |
| ---------------------------------------- | ----- | -------------------------------------------------------------------------- |
| `--dir`      |       | Working directory to start TUI in                                          |
| `--continue` | `-c`  | Continue the last session                                                  |
| `--session`  | `-s`  | Session ID to continue                                                     |
| `--fork`     |       | Fork the session when continuing (use with `--continue` or `--session`)    |
| `--password` | `-p`  | Basic auth password (defaults to `OPENCODE_SERVER_PASSWORD`)               |
| `--username` | `-u`  | Basic auth username (defaults to `OPENCODE_SERVER_USERNAME` or `mrtoro`) |

---

### auth

Command to manage credentials and login for providers.

```bash
mrtoro auth [command]
```

---

#### login

mrtoro is powered by the provider list at [Models.dev](https://models.dev), so you can use `mrtoro auth login` to configure API keys for any provider you'd like to use. This is stored in `~/.local/share/mrtoro/auth.json`.

```bash
mrtoro auth login
```

When mrtoro starts up it loads the providers from the credentials file. And if there are any keys defined in your environments or a `.env` file in your project.

##### Flags

| Flag                                     | Short | Description                                          |
| ---------------------------------------- | ----- | ---------------------------------------------------- |
| `--provider` | `-p`  | Provider ID or name to log in to                     |
| `--method`   | `-m`  | Login method label to use, skipping method selection |

---

#### list

Lists all the authenticated providers as stored in the credentials file.

```bash
mrtoro auth list
```

Or the short version.

```bash
mrtoro auth ls
```

---

#### logout

Logs you out of a provider by clearing it from the credentials file.

```bash
mrtoro auth logout
```

---

### mcp

Manage Model Context Protocol servers.

```bash
mrtoro mcp [command]
```

---

#### add

Add an MCP server to your configuration.

```bash
mrtoro mcp add
```

This command will guide you through adding either a local or remote MCP server.

---

#### list

List all configured MCP servers and their connection status.

```bash
mrtoro mcp list
```

Or use the short version.

```bash
mrtoro mcp ls
```

---

#### auth

Authenticate with an OAuth-enabled MCP server.

```bash
mrtoro mcp auth [name]
```

If you don't provide a server name, you'll be prompted to select from available OAuth-capable servers.

You can also list OAuth-capable servers and their authentication status.

```bash
mrtoro mcp auth list
```

Or use the short version.

```bash
mrtoro mcp auth ls
```

---

#### logout

Remove OAuth credentials for an MCP server.

```bash
mrtoro mcp logout [name]
```

---

#### debug

Debug OAuth connection issues for an MCP server.

```bash
mrtoro mcp debug <name>
```

---

### models

List all available models from configured providers.

```bash
mrtoro models [provider]
```

This command displays all models available across your configured providers in the format `provider/model`.

This is useful for figuring out the exact model name to use in [your config](config.md).

You can optionally pass a provider ID to filter models by that provider.

```bash
mrtoro models anthropic
```

#### Flags

| Flag                                    | Description                                                  |
| --------------------------------------- | ------------------------------------------------------------ |
| `--refresh` | Refresh the models cache from models.dev                     |
| `--verbose` | Use more verbose model output (includes metadata like costs) |

Use the `--refresh` flag to update the cached model list. This is useful when new models have been added to a provider and you want to see them in mrtoro.

```bash
mrtoro models --refresh
```

---

### run

Run mrtoro in non-interactive mode by passing a prompt directly.

```bash
mrtoro run [message..]
```

This is useful for scripting, automation, or when you want a quick answer without launching the full TUI. For example.

```bash "mrtoro run"
mrtoro run Explain the use of context in Go
```

You can also attach to a running `mrtoro serve` instance to avoid MCP server cold boot times on every run:

```bash
# Start a headless server in one terminal
mrtoro serve

# In another terminal, run commands that attach to it
mrtoro run --attach http://localhost:4096 "Explain async/await in JavaScript"
```

#### Flags

| Flag                                     | Short | Description                                                                |
| ---------------------------------------- | ----- | -------------------------------------------------------------------------- |
| `--command`  |       | The command to run, use message for args                                   |
| `--continue` | `-c`  | Continue the last session                                                  |
| `--session`  | `-s`  | Session ID to continue                                                     |
| `--fork`     |       | Fork the session when continuing (use with `--continue` or `--session`)    |
| `--model`    | `-m`  | Model to use in the form of provider/model                                 |
| `--agent`    |       | Agent to use                                                               |
| `--file`     | `-f`  | File(s) to attach to message                                               |
| `--format`   |       | Format: default (formatted) or json (raw JSON events)                      |
| `--title`    |       | Title for the session (uses truncated prompt if no value provided)         |
| `--attach`   |       | Attach to a running mrtoro server (e.g., http://localhost:4096)          |
| `--password` | `-p`  | Basic auth password (defaults to `OPENCODE_SERVER_PASSWORD`)               |
| `--username` | `-u`  | Basic auth username (defaults to `OPENCODE_SERVER_USERNAME` or `mrtoro`) |
| `--dir`      |       | Directory to run in, or path on the remote server when attaching           |
| `--port`     |       | Port for the local server (defaults to random port)                        |
| `--variant`  |       | Model variant (provider-specific reasoning effort)                         |
| `--thinking` |       | Show thinking blocks                                                       |
| `--auto`     |       | Auto-approve permissions that are not explicitly denied                    |

---

### serve

Start a headless mrtoro server for API access. Check out the [server docs](server.md) for the full HTTP interface.

```bash
mrtoro serve
```

This starts an HTTP server that provides API access to mrtoro functionality without the TUI interface. Set `OPENCODE_SERVER_PASSWORD` to enable HTTP basic auth (username defaults to `mrtoro`).

#### Flags

| Flag                                        | Description                                |
| ------------------------------------------- | ------------------------------------------ |
| `--port`        | Port to listen on                          |
| `--hostname`    | Hostname to listen on                      |
| `--mdns`        | Enable mDNS discovery                      |
| `--mdns-domain` | Custom mDNS domain name                    |
| `--cors`        | Additional browser origin(s) to allow CORS |

---

### session

Manage mrtoro sessions.

```bash
mrtoro session [command]
```

---

#### list

List all mrtoro sessions.

```bash
mrtoro session list
```

##### Flags

| Flag                                      | Short | Description                          |
| ----------------------------------------- | ----- | ------------------------------------ |
| `--max-count` | `-n`  | Limit to N most recent sessions      |
| `--format`    |       | Output format: table or json (table) |

---

#### delete

Delete an mrtoro session.

```bash
mrtoro session delete <sessionID>
```

---

### stats

Show token usage and cost statistics for your mrtoro sessions.

```bash
mrtoro stats
```

#### Flags

| Flag                                    | Description                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `--days`    | Show stats for the last N days (all time)                                   |
| `--tools`   | Number of tools to show (all)                                               |
| `--models`  | Show model usage breakdown (hidden by default). Pass a number to show top N |
| `--project` | Filter by project (all projects, empty string: current project)             |

---

### export

Export session data as JSON.

```bash
mrtoro export [sessionID]
```

If you don't provide a session ID, you'll be prompted to select from available sessions.

#### Flags

| Flag                                     | Description                           |
| ---------------------------------------- | ------------------------------------- |
| `--sanitize` | Redact sensitive transcript/file data |

---

### import

Import session data from a JSON file.

```bash
mrtoro import <file>
```

```bash
mrtoro import session.json
```

---

### acp

Start an ACP (Agent Client Protocol) server.

```bash
mrtoro acp
```

This command starts an ACP server that communicates via stdin/stdout using nd-JSON.

#### Flags

| Flag                                        | Description                                |
| ------------------------------------------- | ------------------------------------------ |
| `--cwd`         | Working directory                          |
| `--port`        | Port to listen on                          |
| `--hostname`    | Hostname to listen on                      |
| `--mdns`        | Enable mDNS discovery                      |
| `--mdns-domain` | Custom mDNS domain name                    |
| `--cors`        | Additional browser origin(s) to allow CORS |

---

### plugin

Install a plugin and update your config.

```bash
mrtoro plugin <module>
```

Or use the alias.

```bash
mrtoro plug <module>
```

#### Flags

| Flag                                   | Short | Description                     |
| -------------------------------------- | ----- | ------------------------------- |
| `--global` | `-g`  | Install in global config        |
| `--force`  | `-f`  | Replace existing plugin version |

---

### pr

Fetch and checkout a GitHub PR branch, then run mrtoro.

```bash
mrtoro pr <number>
```

---

### db

Database tools.

```bash
mrtoro db [query]
```

#### Flags

| Flag                                   | Description                    |
| -------------------------------------- | ------------------------------ |
| `--format` | Output format: `json` or `tsv` |

---

#### path

Print the database path.

```bash
mrtoro db path
```

---

### debug

Debugging and troubleshooting tools.

```bash
mrtoro debug [command]
```

---

### uninstall

Uninstall mrtoro and remove all related files.

```bash
mrtoro uninstall
```

#### Flags

| Flag                                        | Short | Description                                 |
| ------------------------------------------- | ----- | ------------------------------------------- |
| `--keep-config` | `-c`  | Keep configuration files                    |
| `--keep-data`   | `-d`  | Keep session data and snapshots             |
| `--dry-run`     |       | Show what would be removed without removing |
| `--force`       | `-f`  | Skip confirmation prompts                   |

---

## Global Flags

The mrtoro CLI takes the following global flags.

| Flag                                       | Short | Description                          |
| ------------------------------------------ | ----- | ------------------------------------ |
| `--help`       | `-h`  | Display help                         |
| `--version`    | `-v`  | Print version number                 |
| `--print-logs` |       | Print logs to stderr                 |
| `--log-level`  |       | Log level (DEBUG, INFO, WARN, ERROR) |
| `--pure`       |       | Run without external plugins         |

---

## Environment variables

mrtoro can be configured using environment variables. The variables are listed with their legacy `OPENCODE_` names; most of them can also be set with the preferred `MRTORO_` prefix instead (for example `MRTORO_CONFIG` instead of `OPENCODE_CONFIG`), and the `MRTORO_` value wins when both are set.

| Variable                              | Type    | Description                                       |
| ------------------------------------- | ------- | ------------------------------------------------- |
| `OPENCODE_GIT_BASH_PATH`              | string  | Path to Git Bash executable on Windows            |
| `OPENCODE_CONFIG`                     | string  | Path to config file                               |
| `OPENCODE_TUI_CONFIG`                 | string  | Path to TUI config file                           |
| `OPENCODE_CONFIG_DIR`                 | string  | Path to config directory                          |
| `OPENCODE_CONFIG_CONTENT`             | string  | Inline json config content                        |
| `OPENCODE_DISABLE_PRUNE`              | boolean | Disable pruning of old data                       |
| `OPENCODE_DISABLE_TERMINAL_TITLE`     | boolean | Disable automatic terminal title updates          |
| `OPENCODE_PERMISSION`                 | string  | Inlined json permissions config                   |
| `OPENCODE_DISABLE_DEFAULT_PLUGINS`    | boolean | Disable default plugins                           |
| `OPENCODE_DISABLE_LSP_DOWNLOAD`       | boolean | Disable automatic LSP server downloads            |
| `OPENCODE_ENABLE_EXPERIMENTAL_MODELS` | boolean | Enable experimental models                        |
| `OPENCODE_DISABLE_AUTOCOMPACT`        | boolean | Disable automatic context compaction              |
| `OPENCODE_DISABLE_MODELS_FETCH`       | boolean | Disable fetching models from remote sources       |
| `OPENCODE_DISABLE_MOUSE`              | boolean | Disable mouse capture in the TUI                  |
| `OPENCODE_FAKE_VCS`                   | string  | Fake VCS provider for testing purposes            |
| `OPENCODE_CLIENT`                     | string  | Client identifier (defaults to `cli`)             |
| `OPENCODE_ENABLE_EXA`                 | boolean | Use Exa for web search (already the default)      |
| `OPENCODE_ENABLE_PARALLEL`            | boolean | Use Parallel instead of Exa for web search        |
| `OPENCODE_SERVER_PASSWORD`            | string  | Enable basic auth for `serve`                    |
| `OPENCODE_SERVER_USERNAME`            | string  | Override basic auth username (default `mrtoro`) |
| `OPENCODE_MODELS_URL`                 | string  | Custom URL for fetching models configuration      |

---

### Experimental

These environment variables enable experimental features that may change or be removed.

| Variable                                        | Type    | Description                             |
| ----------------------------------------------- | ------- | --------------------------------------- |
| `OPENCODE_EXPERIMENTAL`                         | boolean | Enable the experimental umbrella flag   |
| `OPENCODE_EXPERIMENTAL_ICON_DISCOVERY`          | boolean | Enable icon discovery                   |
| `OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT`  | boolean | Disable copy on select in TUI           |
| `OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS` | number  | Default timeout for bash commands in ms |
| `OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX`        | number  | Max output tokens for LLM responses     |
| `OPENCODE_EXPERIMENTAL_FILEWATCHER`             | boolean | Enable file watcher for entire dir      |
| `OPENCODE_EXPERIMENTAL_OXFMT`                   | boolean | Enable oxfmt formatter                  |
| `OPENCODE_EXPERIMENTAL_LSP_TOOL`                | boolean | Enable experimental LSP tool            |
| `OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER`     | boolean | Disable file watcher                    |
| `OPENCODE_EXPERIMENTAL_EXA`                     | boolean | Enable experimental Exa features        |
| `OPENCODE_EXPERIMENTAL_LSP_TY`                  | boolean | Enable TY LSP for python files          |
| `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS`    | boolean | Enable background subagent tasks        |
| `OPENCODE_EXPERIMENTAL_EVENT_SYSTEM`            | boolean | Enable experimental event system        |
| `OPENCODE_EXPERIMENTAL_NATIVE_LLM`              | boolean | Enable native LLM request path          |
| `OPENCODE_EXPERIMENTAL_PARALLEL`                | boolean | Enable parallel web search execution    |
| `OPENCODE_EXPERIMENTAL_WORKSPACES`              | boolean | Enable workspace support                |
