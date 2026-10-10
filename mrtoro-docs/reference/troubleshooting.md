# Troubleshooting

Common issues and how to resolve them.

To debug issues with mrtoro, start by checking the logs and local data it stores on disk.

---

## Logs

Log files are written to:

- **macOS/Linux**: `~/.local/share/mrtoro/log/`
- **Windows**: Press `WIN+R` and paste `%USERPROFILE%\.local\share\mrtoro\log`

Log files are named with timestamps (e.g., `2025-01-09T123456.log`) and the most recent 10 log files are kept.

You can set the log level with the `--log-level` command-line option to get more detailed debug information. For example, `mrtoro --log-level DEBUG`.

---

## Storage

mrtoro stores session data and other application data on disk at:

- **macOS/Linux**: `~/.local/share/mrtoro/`
- **Windows**: Press `WIN+R` and paste `%USERPROFILE%\.local\share\mrtoro`

This directory contains:

- `auth.json` - Authentication data like API keys, OAuth tokens
- `log/` - Application logs
- `project/` - Project-specific data like session and message data
  - If the project is within a Git repo, it is stored in `./<project-slug>/storage/`
  - If it is not a Git repo, it is stored in `./global/storage/`

---

## Uninstall

To uninstall the mrtoro CLI and remove its related files, run:

```bash
mrtoro uninstall
```

The command shows what will be removed and asks for confirmation. See the [CLI reference](cli.md#uninstall) for options to keep your configuration or application data.

---

## Plugin and cache problems

Most startup crashes, hangs, or strange behavior are caused by a misbehaving plugin, a corrupted cache, or a bad server setting.

### Disable plugins

If mrtoro is crashing on launch, hanging, or behaving strangely, start by disabling plugins.

#### Check the global config

Open your global config file and look for a `plugin` key.

- **macOS/Linux**: `~/.config/mrtoro/mrtoro.jsonc` (or `~/.config/mrtoro/mrtoro.json`)
- **Windows**: Press `WIN+R` and paste `%USERPROFILE%\.config\mrtoro\mrtoro.jsonc`

If you have plugins configured, temporarily disable them by removing the key or setting it to an empty array:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [],
}
```

You can also start mrtoro with the `--pure` global flag to run without external plugins.

#### Check plugin directories

mrtoro can also load local plugins from disk. Temporarily move these out of the way (or rename the folder) and restart mrtoro:

- **Global plugins**
  - **macOS/Linux**: `~/.config/mrtoro/plugins/`
  - **Windows**: Press `WIN+R` and paste `%USERPROFILE%\.config\mrtoro\plugins`
- **Project plugins** (only if you use per-project config)
  - `<your-project>/.mrtoro/plugins/`

If mrtoro starts working again, re-enable plugins one at a time to find which one is causing the issue.

---

### Clear the cache

If disabling plugins doesn't help (or a plugin install is stuck), clear the cache so mrtoro can rebuild it.

1. Quit mrtoro completely.
2. Delete the cache directory:

- **macOS**: Finder -> `Cmd+Shift+G` -> paste `~/.cache/mrtoro`
- **Linux**: delete `~/.cache/mrtoro` (or run `rm -rf ~/.cache/mrtoro`)
- **Windows**: Press `WIN+R` and paste `%USERPROFILE%\.cache\mrtoro`

3. Restart mrtoro.

---

### Server settings

If the TUI cannot connect to its local server, check whether your `mrtoro.json(c)` contains a `server` section (`server.port` / `server.hostname`), temporarily remove it, and restart.

---

### Windows: General performance issues

If you're experiencing slow performance, file access issues, or terminal problems on Windows, try using [WSL (Windows Subsystem for Linux)](windows-wsl.md). WSL provides a Linux environment that works more seamlessly with mrtoro's features.

---

## Common issues

Here are some common issues and how to resolve them.

---

### mrtoro won't start

1. Check the logs for error messages
2. Try running with `--print-logs` to see output in the terminal
3. Try `--pure` to rule out external plugins

---

### Authentication issues

1. Try re-authenticating with the `/connect` command in the TUI
2. Check that your API keys are valid
3. Ensure your network allows connections to the provider's API

---

### Model not available

1. Check that you've authenticated with the provider
2. Verify the model name in your config is correct
3. Some models may require specific access or subscriptions

If you encounter `ProviderModelNotFoundError` you are most likely incorrectly
referencing a model somewhere.
Models should be referenced like so: `<providerId>/<modelId>`

Examples:

- `openai/gpt-4.1`
- `openrouter/google/gemini-2.5-flash`
- `myprovider/my-local-model` (a custom provider defined in your config)

To figure out what models you have access to, run `mrtoro models`

---

### ProviderInitError

If you encounter a ProviderInitError, you likely have an invalid or corrupted configuration.

To resolve this:

1. First, verify your provider is set up correctly by following the [providers guide](providers.md)
2. If the issue persists, try clearing your stored configuration:

   ```bash
   rm -rf ~/.local/share/mrtoro
   ```

   On Windows, press `WIN+R` and delete: `%USERPROFILE%\.local\share\mrtoro`

3. Re-authenticate with your provider using the `/connect` command in the TUI.

---

### AI_APICallError and provider package issues

If you encounter API call errors, this may be due to outdated provider packages. mrtoro dynamically installs provider packages (OpenAI, Anthropic, Google, etc.) as needed and caches them locally.

To resolve provider package issues:

1. Clear the provider package cache:

   ```bash
   rm -rf ~/.cache/mrtoro
   ```

   On Windows, press `WIN+R` and delete: `%USERPROFILE%\.cache\mrtoro`

2. Restart mrtoro to reinstall the latest provider packages

This will force mrtoro to download the most recent versions of provider packages, which often resolves compatibility issues with model parameters and API changes.

---

### Copy/paste not working on Linux

Linux users need to have one of the following clipboard utilities installed for copy/paste functionality to work:

**For X11 systems:**

```bash
apt install -y xclip
# or
apt install -y xsel
```

**For Wayland systems:**

```bash
apt install -y wl-clipboard
```

**For headless environments:**

```bash
apt install -y xvfb
# and run:
Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
export DISPLAY=:99.0
```

mrtoro will detect if you're using Wayland and prefer `wl-clipboard`, otherwise it will try to find clipboard tools in order of: `xclip` and `xsel`.
