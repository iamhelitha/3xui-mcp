import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../client.js';
import { ok, fail } from '../format.js';

const protocolEnum = z.enum([
    'vless', 'vmess', 'trojan', 'shadowsocks', 'shadowsocks2022',
    'wireguard', 'socks5', 'http', 'dokodemo-door'
]).describe('Protocol to generate credentials for');

export function registerClientTools(server: McpServer): void {
    server.registerTool(
        'list_clients',
        {
            title: 'List all clients',
            description: 'List every client across all inbounds on the panel, with their email, protocol, enabled state, and traffic limits.',
            inputSchema: {},
            annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true }
        },
        async () => {
            try {
                return ok(await getClient().getClients());
            } catch (error) {
                return fail(error);
            }
        }
    );

    server.registerTool(
        'get_client',
        {
            title: 'Get client by email',
            description: 'Get full details (settings, inbound, traffic limits) for a single client by its exact email. Use list_clients first if you do not know the exact email.',
            inputSchema: {
                email: z.string().describe('Exact client email/identifier')
            },
            annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true }
        },
        async ({ email }) => {
            try {
                return ok(await getClient().getClient(email));
            } catch (error) {
                return fail(error, `Confirm the exact email with list_clients; "${email}" may not exist.`);
            }
        }
    );

    server.registerTool(
        'get_client_traffic',
        {
            title: 'Get client traffic usage',
            description: 'Get upload/download traffic totals and limits for a single client by exact email.',
            inputSchema: {
                email: z.string().describe('Exact client email/identifier')
            },
            annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true }
        },
        async ({ email }) => {
            try {
                return ok(await getClient().getClientTraffic(email));
            } catch (error) {
                return fail(error, `Confirm the exact email with list_clients; "${email}" may not exist.`);
            }
        }
    );

    server.registerTool(
        'list_online_clients',
        {
            title: 'List currently online clients',
            description: 'List the emails of clients that are currently connected/online.',
            inputSchema: {},
            annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true }
        },
        async () => {
            try {
                // getOnlineClients() hits the legacy /panel/api/inbounds/onlines route,
                // which 404s on current (modern, v3.x) panels — getOnlines() hits the
                // modern /panel/api/clients/onlines route and works on both.
                return ok(await getClient().getOnlines());
            } catch (error) {
                return fail(error);
            }
        }
    );

    server.registerTool(
        'create_client',
        {
            title: 'Create client',
            description: 'Create a new client on an existing inbound with auto-generated credentials (UUID/password/keys as appropriate for the protocol). Returns the generated credentials and connection info — surface these to the user, they are not retrievable again in plaintext.',
            inputSchema: {
                inboundId: z.number().int().describe('Numeric ID of the inbound to add the client to (see list_inbounds)'),
                protocol: protocolEnum,
                email: z.string().describe('Unique email/identifier for the new client'),
                totalGB: z.number().min(0).optional().describe('Data limit in GB (0 = unlimited). Converted to bytes automatically.'),
                expiryTime: z.number().int().min(0).optional().describe('Expiry as a Unix ms timestamp (0 = never)'),
                limitIp: z.number().int().min(0).optional().describe('Max simultaneous IPs (0 = unlimited)')
            },
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
        },
        async ({ inboundId, protocol, email, totalGB, expiryTime, limitIp }) => {
            try {
                return ok(await getClient().addClientWithCredentials(inboundId, protocol, {
                    email,
                    totalGB,
                    expiryTime,
                    limitIp
                }));
            } catch (error) {
                return fail(error, `Confirm inboundId ${inboundId} exists and its protocol matches "${protocol}".`);
            }
        }
    );

    server.registerTool(
        'update_client',
        {
            title: 'Update client',
            description: 'Update an existing client\'s traffic limit, expiry, or enabled state. Only the fields you pass are changed; everything else on the client is preserved.',
            inputSchema: {
                clientId: z.string().describe('Client UUID (VLESS/VMess) or password (Trojan/Shadowsocks) — see get_client'),
                inboundId: z.number().int().describe('Numeric ID of the inbound the client belongs to'),
                totalGB: z.number().min(0).optional().describe('New data limit in GB (0 = unlimited)'),
                expiryTime: z.number().int().min(0).optional().describe('New expiry as a Unix ms timestamp (0 = never)'),
                expiryDays: z.number().int().min(0).optional().describe('Alternative to expiryTime: set expiry to N days from now'),
                limitIp: z.number().int().min(0).optional().describe('New max simultaneous IPs (0 = unlimited)'),
                enable: z.boolean().optional().describe('Enable or disable the client')
            },
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }
        },
        async ({ clientId, inboundId, ...options }) => {
            const result = await getClient().updateClientWithCredentials(clientId, inboundId, options);
            if (result && (result as { success?: boolean }).success === false) {
                return fail(new Error((result as { message?: string }).message || 'Update failed'),
                    `Confirm clientId and inboundId ${inboundId} with get_inbound(${inboundId}).`);
            }
            return ok(result);
        }
    );

    server.registerTool(
        'delete_client',
        {
            title: 'Delete client',
            description: 'Permanently delete a client by exact email. This cannot be undone.',
            inputSchema: {
                email: z.string().describe('Exact client email/identifier to delete')
            },
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }
        },
        async ({ email }) => {
            try {
                return ok(await getClient().deleteModernClient(email));
            } catch (error) {
                return fail(error, `Confirm the exact email with list_clients; "${email}" may not exist.`);
            }
        }
    );
}
