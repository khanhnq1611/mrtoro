# Windows (WSL)

Run mrtoro on Windows using WSL for the best experience.

While mrtoro can run directly on Windows, we recommend using [Windows Subsystem for Linux (WSL)](https://learn.microsoft.com/en-us/windows/wsl/install) for the best experience. WSL provides a Linux environment that works seamlessly with mrtoro's features.

> **Why WSL?:**
> WSL offers better file system performance, full terminal support, and compatibility with development tools that mrtoro relies on.

---

## Setup

1. **Install WSL**

   If you haven't already, [install WSL](https://learn.microsoft.com/en-us/windows/wsl/install) using the official Microsoft guide.

2. **Install mrtoro in WSL**

   Once WSL is set up, open your WSL terminal and make the `mrtoro` binary available there (build it inside WSL or copy a Linux build onto your `PATH`). See the [introduction](intro.md).

3. **Use mrtoro from WSL**

   Navigate to your project directory (access Windows files via `/mnt/c/`, `/mnt/d/`, etc.) and run mrtoro.

   ```bash
   cd /mnt/c/Users/YourName/project
   mrtoro
   ```

---

## WSL Server

If you want to run the mrtoro server in WSL and attach to it from another terminal:

1. **Start the server in WSL** with `--hostname 0.0.0.0` to allow external connections:

   ```bash
   mrtoro serve --hostname 0.0.0.0 --port 4096
   ```

2. **Attach a TUI** to it with `mrtoro attach http://localhost:4096`

> **Note:**
> If `localhost` does not work in your setup, connect using the WSL IP address instead (from WSL: `hostname -I`) and use `http://<wsl-ip>:4096`.

> **Caution:**
> When using `--hostname 0.0.0.0`, set `MRTORO_SERVER_PASSWORD` (or legacy `OPENCODE_SERVER_PASSWORD`) to secure the server.

```bash
MRTORO_SERVER_PASSWORD=your-password mrtoro serve --hostname 0.0.0.0
```

---

## Accessing Windows Files

WSL can access all your Windows files through the `/mnt/` directory:

- `C:` drive → `/mnt/c/`
- `D:` drive → `/mnt/d/`
- And so on...

Example:

```bash
cd /mnt/c/Users/YourName/Documents/project
mrtoro
```

> **Tip:**
> For the smoothest experience, consider cloning/copying your repo into the WSL filesystem (for example under `~/code/`) and running mrtoro there.

---

## Tips

- Keep mrtoro running in WSL for projects stored on Windows drives - file access is seamless
- Use VS Code's [WSL extension](https://code.visualstudio.com/docs/remote/wsl) alongside mrtoro for an integrated development workflow
- Your mrtoro config and sessions are stored within the WSL environment at `~/.local/share/mrtoro/`
