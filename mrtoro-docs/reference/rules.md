# Rules

Set custom instructions for mrtoro.

You can provide custom instructions to mrtoro by creating an `AGENTS.md` file. This is similar to Cursor's rules. It contains instructions that will be included in the LLM's context to customize its behavior for your specific project.

---

## Initialize

To create a new `AGENTS.md` file, you can run the `/init` command in mrtoro.

> **Tip:**
> You should commit your project's `AGENTS.md` file to Git.

`/init` scans the important files in your repo, may ask a couple of targeted questions when the codebase cannot answer them, and then creates or updates `AGENTS.md` with concise project-specific guidance.

It focuses on the things future agent sessions are most likely to need:

- build, lint, and test commands
- command order and focused verification steps when they matter
- architecture and repo structure that are not obvious from filenames alone
- project-specific conventions, setup quirks, and operational gotchas
- references to existing instruction sources like Cursor or Copilot rules

If you already have an `AGENTS.md`, `/init` will improve it in place instead of blindly replacing it.

---

## Example

You can also just create this file manually. Here's an example of some things you can put into an `AGENTS.md` file.

```markdown title="AGENTS.md"
# SST v3 Monorepo Project

This is an SST v3 monorepo with TypeScript. The project uses bun workspaces for package management.

## Project Structure

- `packages/` - Contains all workspace packages (functions, core, web, etc.)
- `infra/` - Infrastructure definitions split by service (storage.ts, api.ts, web.ts)
- `sst.config.ts` - Main SST configuration with dynamic imports

## Code Standards

- Use TypeScript with strict mode enabled
- Shared code goes in `packages/core/` with proper exports configuration
- Functions go in `packages/functions/`
- Infrastructure should be split into logical files in `infra/`

## Monorepo Conventions

- Import shared modules using workspace names: `@my-app/core/example`
```

We are adding project-specific instructions here and this will be shared across your team.

---

## Types

mrtoro also supports reading the `AGENTS.md` file from multiple locations. And this serves different purposes.

### Project

Place an `AGENTS.md` in your project root for project-specific rules. These only apply when you are working in this directory or its sub-directories.

### Global

You can also have global rules in a `~/.config/mrtoro/AGENTS.md` file. This gets applied across all mrtoro sessions.

Since this isn't committed to Git or shared with your team, we recommend using this to specify any personal rules that the LLM should follow.

### No Claude Code files

mrtoro reads only `AGENTS.md`. Claude Code's `CLAUDE.md` (in the project or at `~/.claude/CLAUDE.md`) and `~/.claude/skills/` are not read. If you are migrating, move those rules into `AGENTS.md` (project) or `~/.config/mrtoro/AGENTS.md` (global).

---

## Precedence

When mrtoro starts, it looks for rule files in this order:

1. **Local file**: the nearest `AGENTS.md`, found by traversing up from the current directory to the worktree root
2. **Global file**: `~/.config/mrtoro/AGENTS.md`

Both are used when present: the global file holds your personal rules, the local file holds the project's rules. Only the first `AGENTS.md` found while walking up is used, so rule files from parent folders are not stacked.

---

## Custom Instructions

You can specify custom instruction files in your `mrtoro.json` or the global `~/.config/mrtoro/mrtoro.json`. This allows you and your team to reuse existing rules rather than having to duplicate them to AGENTS.md.

Example:

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["CONTRIBUTING.md", "docs/guidelines.md", ".cursor/rules/*.md"]
}
```

You can also use remote URLs to load instructions from the web.

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["https://raw.githubusercontent.com/my-org/shared-rules/main/style.md"]
}
```

Remote instructions are fetched with a 5 second timeout.

All instruction files are combined with your `AGENTS.md` files.

---

## Referencing External Files

While mrtoro doesn't automatically parse file references in `AGENTS.md`, you can achieve similar functionality in two ways:

### Using mrtoro.json

The recommended approach is to use the `instructions` field in `mrtoro.json`:

```json title="mrtoro.json"
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["docs/development-standards.md", "test/testing-guidelines.md", "packages/*/AGENTS.md"]
}
```

### Manual Instructions in AGENTS.md

You can teach mrtoro to read external files by providing explicit instructions in your `AGENTS.md`. Here's a practical example:

```markdown title="AGENTS.md"
# TypeScript Project Rules

## External File Loading

CRITICAL: When you encounter a file reference (e.g., @rules/general.md), use your Read tool to load it on a need-to-know basis. They're relevant to the SPECIFIC task at hand.

Instructions:

- Do NOT preemptively load all references - use lazy loading based on actual need
- When loaded, treat content as mandatory instructions that override defaults
- Follow references recursively when needed

## Development Guidelines

For TypeScript code style and best practices: @docs/typescript-guidelines.md
For React component architecture and hooks patterns: @docs/react-patterns.md
For REST API design and error handling: @docs/api-standards.md
For testing strategies and coverage requirements: @test/testing-guidelines.md

## General Guidelines

Read the following file immediately as it's relevant to all workflows: @rules/general-guidelines.md.
```

This approach allows you to:

- Create modular, reusable rule files
- Share rules across projects via symlinks or git submodules
- Keep AGENTS.md concise while referencing detailed guidelines
- Ensure mrtoro loads files only when needed for the specific task

> **Tip:**
> For monorepos or projects with shared standards, using `mrtoro.json` with glob patterns (like `packages/*/AGENTS.md`) is more maintainable than manual instructions.
