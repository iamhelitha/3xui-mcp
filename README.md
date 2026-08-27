<p align="center">
  <img src="assets/banner.png" alt="3xui-mcp — 3x-ui at your fingertips for AI agents" width="100%" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/3xui-mcp"><img alt="npm version" src="https://img.shields.io/npm/v/3xui-mcp.svg"></a>
  <a href="https://www.npmjs.com/package/3xui-mcp"><img alt="npm downloads" src="https://img.shields.io/npm/dw/3xui-mcp.svg"></a>
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/npm/l/3xui-mcp.svg"></a>
  <img alt="node engine" src="https://img.shields.io/node/v/3xui-mcp.svg">
  <a href="https://github.com/iamhelitha/3xui-mcp/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/iamhelitha/3xui-mcp?style=social"></a>
</p>

# 3xui-mcp

MCP (Model Context Protocol) server for the [3x-ui](https://github.com/MHSanaei/3x-ui) panel, built on [`3xui-api-client`](https://www.npmjs.com/package/3xui-api-client). Manage inbounds and clients on your VPN panel directly from Claude, Cursor, VS Code, or any MCP-compatible client.

Scoped intentionally to keep tool context small: **read operations** plus **full CRUD for inbounds and clients**. Nodes, groups, geo files, backups, Xray config, and panel settings are out of scope — see [Contributing](#contributing) if you need them.

## Contents

- [Requirements](#requirements)
- [Tools](#tools)
- [Configuration](#configuration)
- [Use with an MCP client](#use-with-an-mcp-client)
- [Example prompts](#example-prompts)
- [Agent skill](#agent-skill)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Requirements

- Node.js **≥ 18**
- A reachable 3x-ui panel — any version [`3xui-api-client`](https://github.com/iamhelitha/3xui-api-client) supports: modern (React, v3.x+) and legacy (Vue, v2.x), auto-detected
- Admin credentials for that panel (username/password or an API token)

## Tools

| Tool | Type | Description |
|---|---|---|
| `list_inbounds` | read | List all inbounds |
| `get_inbound` | read | Get one inbound by ID |
| `create_inbound` | write | Create an inbound |
| `update_inbound` | write | Replace an inbound's config |
| `delete_inbound` | write | Delete an inbound |
| `list_clients` | read | List all clients across inbounds |
| `get_client` | read | Get one client by email |
| `get_client_traffic` | read | Get a client's traffic usage |
| `list_online_clients` | read | List currently connected clients |
| `create_client` | write | Add a client with auto-generated credentials |
| `update_client` | write | Update a client's limits/expiry/state |
| `delete_client` | write | Delete a client by email |

## Configuration

Set credentials via environment variables — pick **one** auth mode:

```bash
# Required — protocol + host + port, plus your panel's custom base path if it has
# one (most 3x-ui panels do, e.g. a random string appended for security). Example
# shape: https://your-panel.example.com:2053/aB3xR9qKzL
THREEXUI_BASE_URL=https://your-panel.example.com:2053/your-webBasePath

# Cookie auth (admin username/password)
THREEXUI_USERNAME=admin
THREEXUI_PASSWORD=your-password

# OR API token auth (skips username/password)
THREEXUI_API_TOKEN=your-token

# Optional, default "auto"
THREEXUI_PANEL_TYPE=auto   # auto | modern | legacy
```

Do **not** include a trailing `/panel` — the underlying client appends panel paths itself.

## Use with an MCP client

No install or path needed — `npx` fetches and runs the published package on demand.

### Claude Desktop

Add to `claude_desktop_config.json`:

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

### Claude Code (CLI)

```bash
claude mcp add --env THREEXUI_BASE_URL=https://your-panel.example.com:2053/your-webBasePath \
  --env THREEXUI_USERNAME=admin \
  --env THREEXUI_PASSWORD=your-password \
  3xui -- npx -y 3xui-mcp
```

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project-scoped) — same schema as Claude Desktop above:

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

### VS Code (GitHub Copilot)

Add to `.vscode/mcp.json` — note the top-level key is `servers`, not `mcpServers`:

```json
{
  "servers": {
    "3xui": {
      "type": "stdio",
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

### Running from source instead

See [Contributing](#contributing) if you'd rather build and point your MCP config at a local checkout.

## Example prompts

Once configured, you can ask your agent things like:

- "List all my 3x-ui inbounds and how many clients are on each"
- "Show me which clients are currently online"
- "Add a new VLESS client called `alice` to inbound 3 with a 50GB limit"
- "How much data has `bob@example.com` used, and when does it expire?"
- "Extend `alice`'s client by 30 days"
- "Disable the client with email `old-user`"
- "Create a new inbound on port 9000 with the same settings as inbound 1, just a different remark"

The agent maps these to the tool calls above — see [Agent skill](#agent-skill) for the reference it uses to get field formats right.

## Agent skill

[`skills/3xui-mcp/SKILL.md`](skills/3xui-mcp/SKILL.md) documents every tool's required/optional fields, units (GB vs bytes, ms timestamps), and common workflows for an AI agent driving this server — load it alongside the server so the agent doesn't have to guess input shapes from tool descriptions alone.

## Security

- **Your panel credentials grant full admin access.** `THREEXUI_USERNAME`/`THREEXUI_PASSWORD` (or `THREEXUI_API_TOKEN`) are only as safe as the MCP client config file they live in (e.g. `claude_desktop_config.json`) — protect that file with normal OS file permissions, and never commit it. Prefer an API token over username/password where your panel supports it: tokens can be scoped and revoked without invalidating a session. See [`3xui-api-client`'s Session Security notes](https://github.com/iamhelitha/3xui-api-client#session-security) for how the underlying session cookie is handled.
- **`create_client`'s generated credentials are shown once.** The UUID/password/keys returned in that tool's response are not retrievable in plaintext afterward — if you're driving this via an agent, make sure it actually surfaces them to you rather than just reporting success.
- **Write tools are irreversible.** `delete_inbound` and `delete_client` have no confirmation step built into the tool itself — that's the calling agent's responsibility (see [`SKILL.md`](skills/3xui-mcp/SKILL.md)'s guidance on this). If you're driving the server directly (not through an agent), double-check IDs/emails before calling them.

## Troubleshooting

**`Missing required environment variable: THREEXUI_BASE_URL`** (or `_USERNAME`/`_PASSWORD`)
Your MCP client's config is missing the `env` block, or it's missing one of the required entries. Check the [Configuration](#configuration) section — exactly one auth mode (username/password or API token) must be fully set.

**Login fails / tools return a 401 or 404**
Confirm `THREEXUI_BASE_URL` doesn't include a trailing `/panel` and does include any custom base path your panel uses. If your panel is on an unusual setup, try setting `THREEXUI_PANEL_TYPE` explicitly (`modern` or `legacy`) instead of `auto`.

**A write tool succeeds but the change isn't visible in the panel UI**
Some panels cache dashboard views — try refreshing. If the tool's response has `success: true`, the change was accepted by the panel API.

**Still stuck?** Open an issue with the tool name, a redacted version of the error, and your panel version if known.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development setup, how to add a new tool, and the release process.

## License

[Apache-2.0](LICENSE)
