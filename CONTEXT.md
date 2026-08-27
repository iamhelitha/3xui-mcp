# Development context / handoff

This file exists so work on this repo can continue from a fresh session or a
different machine without re-deriving the decisions below. It documents *why*
things are the way they are, not what the code does (the code + README cover
that).

## Origin

Extracted from [`3xui-api-client`](https://github.com/iamhelitha/3xui-api-client)
(`mcp-server/` subfolder) into its own repo so it can be versioned, tested,
and published independently. It depends on `3xui-api-client` as a normal npm
dependency (`^3.2.0`), not a local path — there is no monorepo/workspace
relationship anymore.

## Scope decision

The 3x-ui panel API surface is large (nodes, groups, custom geo files,
backups, Xray config, panel settings, security stats, WARP, ...). This server
deliberately exposes **only**:

- Read/info tools (list/get inbounds, clients, traffic, online status)
- Full CRUD for **inbounds**
- Full CRUD for **clients**

This was an explicit user requirement, not an oversight: a full 60+ method
API surface as MCP tools would exhaust an agent's context just listing tool
schemas. If more coverage is needed later, extend `src/tools/` with a new
file per resource area (mirror the `inbounds.ts`/`clients.ts` pattern) rather
than dumping everything into the existing two files.

## Design choices worth knowing

- **`create_client`/`update_client` use the library's `addClientWithCredentials`/
  `updateClientWithCredentials` helpers**, not the raw `addClient`/`updateClient`.
  Those helpers auto-generate protocol-appropriate credentials (UUID, Reality
  keys, etc.) and accept `totalGB` in GB / `expiryDays` in days, converting to
  the panel's byte/timestamp units internally — much better UX for an LLM
  caller than hand-computing bytes or Unix ms timestamps.
- **`list_online_clients` calls `getOnlines()`, not `getOnlineClients()`.**
  The legacy `getOnlineClients()` (`/panel/api/inbounds/onlines`) 404s on
  modern (v3.x) panels — confirmed against both a fresh Docker
  `ghcr.io/mhsanaei/3x-ui:latest` container and a real production panel. The
  modern `getOnlines()` (`/panel/api/clients/onlines`) works on both. If you
  add more tools, sanity-check the legacy-vs-modern endpoint choice the same
  way rather than assuming the first method you find in `index.d.ts` is the
  live one — the library's legacy API family isn't universally supported by
  current panel builds.
- **Inbound config fields are typed loosely** (`z.union([z.string(), z.record(z.unknown())])`)
  because `settings`/`streamSettings`/`sniffing` are protocol-specific JSON
  blobs the panel accepts as either an object or a JSON string depending on
  panel version. The tool descriptions tell the agent to call `get_inbound`
  on a similar existing inbound first to learn the exact shape, rather than
  trying to model every protocol's schema in Zod.
- **`asInboundConfig()` cast in `tools/inbounds.ts`** works around
  `3xui-api-client`'s hand-maintained `index.d.ts` typing `InboundConfig`
  fields (e.g. `remark`) as required when they're actually optional at the
  HTTP layer — the library's own `InputValidator.validateInboundConfig` is
  the real source of truth and throws a clear runtime error on anything
  genuinely missing.
- **`panelTypeOption` cast in `client.ts`** works around a (now-fixed
  upstream, but not yet released to npm as of writing) bug where
  `3xui-api-client`'s `index.d.ts` typed the constructor option as
  `panelVersion` while the runtime only ever read `panelType`. **Check
  whether the installed `3xui-api-client` version's `index.d.ts` has this
  fixed** (`grep panelType node_modules/3xui-api-client/index.d.ts` — should
  show `panelType?:`, not `panelVersion?:`); once it has, delete the cast and
  pass `{ panelType }` directly.

## Testing performed

- Full CRUD cycle (create/list/get/update/delete for both inbounds and
  clients) verified against a throwaway `ghcr.io/mhsanaei/3x-ui:latest`
  Docker container via `@modelcontextprotocol/inspector --cli`.
- `list_online_clients` additionally verified against a real production 3x-ui
  panel (returned actual connected-client emails).
- No automated test suite exists yet for this server (the parent library has
  Jest unit tests; this repo does not). If you add one, prefer testing the
  Zod schemas and the `format.ts` helpers in isolation — testing the tools
  themselves needs either a live panel or a mocked `3xui-api-client`, neither
  of which is wired up here yet.

## Known follow-ups (not yet done)

- No CI (lint/build) workflow — copy one from the parent repo's
  `.github/workflows/` and adapt.
- No automated tests (see above).
- Not yet published anywhere — see README "Publishing" section once added,
  or the decision below.
- Once `3xui-api-client` ships the `panelType` type fix on npm, remove the
  `panelTypeOption` cast in `client.ts` (see above).

## Where to publish (decided, not yet executed)

- **npm** as `3xui-mcp-server` — primary distribution; lets users run it via
  `npx 3xui-mcp-server` without cloning.
- **GitHub** (this repo) — source of truth, referenced from npm's
  `repository` field.
- **Official MCP servers registry** (`github.com/modelcontextprotocol/servers`)
  — submit via PR once the server has some real-world usage/testing behind it.
- **Smithery.ai** / **Glama.ai MCP directory** — third-party discovery sites,
  free to list, worth doing after the npm package is stable.
