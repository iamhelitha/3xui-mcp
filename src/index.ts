#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerInboundTools } from './tools/inbounds.js';
import { registerClientTools } from './tools/clients.js';

const server = new McpServer({ name: '3xui-mcp', version: '0.1.2' });

registerInboundTools(server);
registerClientTools(server);

async function main(): Promise<void> {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((error: unknown) => {
    console.error('3xui-mcp failed to start:', error);
    process.exit(1);
});
