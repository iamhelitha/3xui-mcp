---
name: 3xui-mcp
description: Use when the user wants to inspect or manage a 3x-ui VPN panel — listing inbounds/clients, checking traffic or online status, or creating/updating/deleting inbounds and clients — via the 3xui-mcp MCP server. Covers how to start the server, which credentials it needs, and the exact input/output shape of every tool.
---

# 3xui-mcp

MCP server that exposes a [3x-ui](https://github.com/MHSanaei/3x-ui) panel's
read operations and full inbound/client CRUD as 12 tools, built on
[`3xui-api-client`](https://www.npmjs.com/package/3xui-api-client).

Scope is intentionally limited to **read tools + inbound CRUD + client
CRUD**. Nodes, groups, custom geo files, backups, Xray config, and panel
settings are out of scope — there is no tool for them.

## Running the server

```bash
npx -y 3xui-mcp
```

or, if working from source:

```bash
npm install && npm run build && npm start
```

The server speaks MCP over stdio. Register it in the host's MCP config, e.g.
for Claude Desktop / Claude Code:

```json
{
  "mcpServers": {
    "3xui": {
      "command": "npx",
      "args": ["-y", "3xui-mcp"],
      "env": {
        "THREEXUI_BASE_URL": "https://your-panel.example.com:2053/your-webBasePath",
        "THREEXUI_USERNAME": "admin",
        "THREEXUI_PASSWORD": "your-password"
      }
    }
  }
}
```

## Required environment variables (credentials)

Exactly one auth mode must be configured, via `env` in the MCP config (not
passed as tool arguments — the tools never take credentials):

| Variable | Required | Notes |
|---|---|---|
| `THREEXUI_BASE_URL` | always | Panel URL including protocol and port, e.g. `https://host:2053` or `https://host:2053/customBasePath`. Do **not** include a trailing `/panel`. |
| `THREEXUI_USERNAME` + `THREEXUI_PASSWORD` | for cookie auth | Admin login credentials. Use this OR the token below, not both. |
| `THREEXUI_API_TOKEN` | for token auth | Bearer API token. Skips username/password entirely. |
| `THREEXUI_PANEL_TYPE` | optional | `auto` (default) \| `modern` \| `legacy`. Leave as `auto` unless login detection is failing. |

If neither auth mode is fully set, every tool call fails immediately with
`Missing required environment variable: ...` — this means the MCP host
config is missing `env` entries, not a tool-usage error. Tell the user to
fix their MCP config rather than retrying the tool call.

## Tool reference

All tools return their result as a JSON string in the response's `content`.
Parse it — the shape is always the raw 3x-ui panel envelope:
`{ success: boolean, msg: string, obj: <data or null> }`, plus extra fields
on a couple of tools (noted below). A tool that throws returns
`isError: true` with a human-readable message and often a `Hint:` line
telling you what to check or call next — read the hint before retrying.

### Read tools (no side effects)

| Tool | Required fields | Optional fields | Returns |
|---|---|---|---|
| `list_inbounds` | — | — | `obj`: array of inbound objects (id, remark, port, protocol, settings, streamSettings, sniffing, clientStats, traffic totals) |
| `get_inbound` | `id` (integer) | — | `obj`: one full inbound object, same shape as above |
| `list_clients` | — | — | `obj`: array of every client across all inbounds (email, uuid/password, limits, traffic, inboundIds) |
| `get_client` | `email` (string) | — | `obj.client`: full client record; `obj.inboundIds`, `obj.usedTraffic` |
| `get_client_traffic` | `email` (string) | — | `obj`: `{ up, down, total, expiryTime, enable, ... }` traffic/limit snapshot |
| `list_online_clients` | — | — | `obj`: array of email strings currently connected |

`email` must be the client's **exact** stored email/identifier — there is no
fuzzy match. If you don't know it, call `list_clients` or `list_inbounds`
first and read the email off a client record.

### Inbound CRUD

| Tool | Required fields | Optional fields | Notes |
|---|---|---|---|
| `create_inbound` | none strictly required by the tool schema, but the panel needs at least `port` and `protocol` to succeed | `remark`, `port`, `protocol`, `settings`, `streamSettings`, `sniffing`, `listen`, `enable`, `expiryTime` | See "Inbound config format" below |
| `update_inbound` | `id` (integer) | same optional fields as `create_inbound` | **Replaces** the inbound config — see warning below |
| `delete_inbound` | `id` (integer) | — | Irreversible. Also deletes every client on that inbound. |

**Before calling `update_inbound`**, call `get_inbound(id)` first and merge
your changes into the full returned object. `update_inbound` does not patch
— fields you omit are not preserved from panel's perspective the way you
might expect from a REST PATCH; always resend the complete config.

**Inbound config format** (`settings` / `streamSettings` / `sniffing`):
each accepts either a plain object or a JSON-encoded string — the panel
accepts both depending on version. These are protocol-specific blobs with no
fixed schema across protocols (VLESS reality settings look nothing like
Shadowsocks settings). **Do not guess the shape.** Call `get_inbound` on an
existing inbound of the same protocol first and copy its `settings` /
`streamSettings` / `sniffing` structure, editing only the fields you need to
change.

Example minimal `settings` for a fresh VLESS inbound:
```json
{ "clients": [], "decryption": "none" }
```
Example minimal `streamSettings` (plain TCP, no security):
```json
{ "network": "tcp", "security": "none" }
```
Example `sniffing`:
```json
{ "enabled": true, "destOverride": ["http", "tls"] }
```

`protocol` is a free-form string here (not validated against an enum) — use
one of: `vless`, `vmess`, `trojan`, `shadowsocks`, `wireguard`, `socks`,
`http`, `dokodemo-door`.

### Client CRUD

| Tool | Required fields | Optional fields | Notes |
|---|---|---|---|
| `create_client` | `inboundId` (integer), `protocol` (enum), `email` (string) | `totalGB` (number), `expiryTime` (integer), `limitIp` (integer) | Auto-generates credentials — see below |
| `update_client` | `clientId` (string), `inboundId` (integer) | `totalGB`, `expiryTime`, `expiryDays`, `limitIp`, `enable` (boolean) | Patches only the fields you pass |
| `delete_client` | `email` (string) | — | Irreversible |

**`create_client` credential generation**: you do not supply a UUID,
password, or keys — the server generates protocol-appropriate credentials
automatically (a VLESS/VMess client gets a UUID + flow, a Trojan/Shadowsocks
client gets a password, a WireGuard client gets a keypair, etc.) and returns
them in the response under a top-level `credentials` field alongside the
usual `{success, msg, obj}`. **These credentials are shown once and are not
retrievable in plaintext afterward** — surface them to the user immediately
(they need them to configure their VPN client), don't just report success.

`protocol` for `create_client` **is** a strict enum, unlike the inbound
tools: `vless` | `vmess` | `trojan` | `shadowsocks` | `shadowsocks2022` |
`wireguard` | `socks5` | `http` | `dokodemo-door`. It must match the target
inbound's actual protocol (call `get_inbound` first if unsure).

**Units**: `totalGB` is in **gigabytes** (not bytes) on both `create_client`
and `update_client` — pass `totalGB: 100` for a 100 GB cap; the server
converts to the panel's byte representation internally. `0` means
unlimited. `expiryTime` is a **Unix millisecond timestamp** (`0` = never
expires). `update_client` also accepts `expiryDays` as a convenience — pass
e.g. `expiryDays: 30` to set expiry to 30 days from now instead of computing
a timestamp yourself; don't pass both `expiryTime` and `expiryDays`.

**`update_client`'s `clientId`** is the client's UUID (VLESS/VMess) or its
password (Trojan/Shadowsocks) — not its email. Get it from `get_client`'s
`obj.client.uuid` (or `.password`) field, or from the `credentials` returned
by `create_client`. `email` is not accepted by `update_client` — clients are
addressed by `clientId` + `inboundId` for updates, but by `email` for
`get_client`/`get_client_traffic`/`delete_client`. Don't mix these up.

## Common workflows

- **"Show me my VPN clients"** → `list_clients` (or `list_online_clients` for
  just who's connected right now).
- **"Add a new VLESS client to inbound 5"** → `create_client` with
  `inboundId: 5, protocol: "vless", email: "<chosen-name>"`; report the
  returned `credentials` to the user.
- **"Give client X 100GB more / extend by 30 days"** → `get_client` to find
  current `totalGB`/`clientId`/`inboundId`, compute the new total, then
  `update_client` with the new `totalGB` (and/or `expiryDays: 30`).
- **"Set up a new inbound like inbound 3 but on port 9000"** → `get_inbound`
  on inbound 3, copy its `settings`/`streamSettings`/`sniffing` verbatim into
  `create_inbound`, only changing `port` and `remark`.
- **Any delete** (`delete_inbound`, `delete_client`) is irreversible and has
  no confirmation step in the tool itself — confirm with the user before
  calling it, the same as any other destructive action.
