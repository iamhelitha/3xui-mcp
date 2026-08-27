# Contributing to 3xui-mcp

## Scope

This server deliberately exposes only **read tools + full inbound CRUD + full client CRUD** — see the README's [Tools](README.md#tools) table for the exact list. It does not cover nodes, groups, custom geo files, backups, Xray config, or panel settings, and PRs adding those are unlikely to be merged without discussion first — the whole point is keeping the tool list small enough that an agent's context isn't dominated by tool schemas. Read [`CONTEXT.md`](CONTEXT.md) before proposing scope changes; it documents why the boundary is where it is and the non-obvious design decisions already made (credential-generating helpers, the `getOnlines()` vs `getOnlineClients()` endpoint choice, the typing workarounds).

## Development setup

```bash
git clone https://github.com/iamhelitha/3xui-mcp.git
cd 3xui-mcp
npm install
npm run build
```

`npm run dev` runs `tsc --watch` for iterative development.

## Adding a new tool

Follow the pattern in `src/tools/inbounds.ts` / `src/tools/clients.ts`: one `registerTool` call per tool, a Zod `inputSchema`, `ok()`/`fail()` from `src/format.ts` for consistent response shaping, and `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) set accurately — MCP clients use these to decide whether to prompt for confirmation.

## Testing locally

```bash
npm run inspector
```

Opens the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) against your local build — lets you call tools directly and inspect request/response shapes without wiring up a full MCP client. Point `THREEXUI_BASE_URL`/`THREEXUI_USERNAME`/`THREEXUI_PASSWORD` at a real (ideally throwaway/test) 3x-ui panel, or a local Docker instance:

```bash
docker run -d -p 2053:2053 ghcr.io/mhsanaei/3x-ui:latest
```

## Pull requests

- `npm run build` must pass — this is the required CI check on `main`.
- Keep changes scoped to what's described above; open an issue first for anything that expands tool coverage.
- Update `README.md`'s Tools table and `skills/3xui-mcp/SKILL.md` if you add, remove, or change a tool's fields.

## Release process

Versioning lives in GitHub Releases, not in manual `package.json` commits:

1. Draft a [new GitHub Release](https://github.com/iamhelitha/3xui-mcp/releases/new) with tag `vX.Y.Z` (must match `vX.Y.Z` or `vX.Y.Z-prerelease`).
2. Publishing the release triggers [`.github/workflows/release.yml`](.github/workflows/release.yml), which builds, sets `package.json`'s version to match the tag, and runs `npm publish`.
3. If the release event doesn't fire the workflow (GitHub occasionally misses it), trigger it manually: Actions → **Publish to npm** → **Run workflow**, entering the same tag. Add `dry_run: true` there to validate the build/versioning/publish steps via `npm publish --dry-run` without actually publishing.

Requires a repo secret `NPM_TOKEN` — an npm access token with publish rights and 2FA bypass enabled for automation, added under **Settings → Secrets and variables → Actions**. Note: npm is deprecating 2FA-bypass tokens for publishing ([details](https://gh.io/npm-gat-bypass2fa-deprecation)) — check that link before it becomes a hard break; the likely replacement is npm's [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC, no stored token at all).

The version checked into `package.json` on `main` is a starting point only; the release tag is the source of truth for what actually gets published. Bump it locally too when convenient so the repo doesn't drift too far from the last published version, but the workflow doesn't depend on it matching.
