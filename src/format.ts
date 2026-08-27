import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** Wraps a resolved API payload as MCP tool text content. */
export function ok(data: unknown): CallToolResult {
    return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
}

/** Wraps a caught error as MCP tool error content, guiding the agent toward a fix. */
export function fail(error: unknown, hint?: string): CallToolResult {
    const message = error instanceof Error ? error.message : String(error);
    const text = hint ? `${message}\n\nHint: ${hint}` : message;
    return {
        content: [{ type: 'text', text }],
        isError: true
    };
}
