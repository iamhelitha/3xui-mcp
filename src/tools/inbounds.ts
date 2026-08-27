import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { InboundConfig } from '3xui-api-client';
import { getClient } from '../client.js';
import { ok, fail } from '../format.js';

// index.d.ts's InboundConfig marks fields like `remark` as required, but the
// runtime (InputValidator.validateInboundConfig) is the actual source of
// truth and throws a clear error on anything genuinely missing — so callers
// here pass the zod-validated partial shape as-is rather than over-fitting
// to the stricter type.
function asInboundConfig(config: unknown): InboundConfig {
    return config as InboundConfig;
}

const inboundConfigShape = {
    remark: z.string().optional().describe('Display name for the inbound'),
    port: z.number().int().optional().describe('Listening port'),
    protocol: z.string().optional().describe('vless | vmess | trojan | shadowsocks | wireguard | socks | http | dokodemo-door'),
    settings: z.union([z.string(), z.record(z.unknown())]).optional()
        .describe('Protocol settings object (or JSON string), e.g. { clients: [...], decryption: "none" }'),
    streamSettings: z.union([z.string(), z.record(z.unknown())]).optional()
        .describe('Transport settings object (or JSON string), e.g. { network: "tcp", security: "reality", ... }'),
    sniffing: z.union([z.string(), z.record(z.unknown())]).optional()
        .describe('Sniffing settings object (or JSON string), e.g. { enabled: true, destOverride: ["http","tls"] }'),
    listen: z.string().optional(),
    enable: z.boolean().optional(),
    expiryTime: z.number().optional()
};

export function registerInboundTools(server: McpServer): void {
    server.registerTool(
        'list_inbounds',
        {
            title: 'List inbounds',
            description: 'List every inbound configured on the 3x-ui panel, including their clients, protocol, port, and traffic stats.',
            inputSchema: {},
            annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true }
        },
        async () => {
            try {
                return ok(await getClient().getInbounds());
            } catch (error) {
                return fail(error);
            }
        }
    );

    server.registerTool(
        'get_inbound',
        {
            title: 'Get inbound by ID',
            description: 'Get full details of a single inbound (protocol settings, stream settings, clients, traffic) by its numeric ID. Use list_inbounds first to find the ID.',
            inputSchema: {
                id: z.number().int().describe('Numeric inbound ID')
            },
            annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true }
        },
        async ({ id }) => {
            try {
                return ok(await getClient().getInbound(id));
            } catch (error) {
                return fail(error, `Confirm the inbound ID with list_inbounds; ${id} may not exist.`);
            }
        }
    );

    server.registerTool(
        'create_inbound',
        {
            title: 'Create inbound',
            description: 'Create a new inbound on the panel. Recommend calling get_inbound on a similar existing inbound first to see the exact shape expected for settings/streamSettings/sniffing on this panel version.',
            inputSchema: inboundConfigShape,
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
        },
        async (config) => {
            try {
                return ok(await getClient().addInbound(asInboundConfig(config)));
            } catch (error) {
                return fail(error, 'Check that port is free and settings/streamSettings match the protocol.');
            }
        }
    );

    server.registerTool(
        'update_inbound',
        {
            title: 'Update inbound',
            description: 'Update an existing inbound by ID. This replaces the inbound configuration, so fetch it with get_inbound first and merge your changes into the full object rather than sending a partial one.',
            inputSchema: {
                id: z.number().int().describe('Numeric inbound ID to update'),
                ...inboundConfigShape
            },
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }
        },
        async ({ id, ...config }) => {
            try {
                return ok(await getClient().updateInbound(id, asInboundConfig(config)));
            } catch (error) {
                return fail(error, `Fetch the current config with get_inbound(${id}) and resend the full object with your changes merged in.`);
            }
        }
    );

    server.registerTool(
        'delete_inbound',
        {
            title: 'Delete inbound',
            description: 'Permanently delete an inbound and all of its clients by ID. This cannot be undone.',
            inputSchema: {
                id: z.number().int().describe('Numeric inbound ID to delete')
            },
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }
        },
        async ({ id }) => {
            try {
                return ok(await getClient().deleteInbound(id));
            } catch (error) {
                return fail(error, `Confirm the inbound ID with list_inbounds; ${id} may not exist.`);
            }
        }
    );
}
