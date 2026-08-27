import ThreeXUI from '3xui-api-client';

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

/**
 * Builds a singleton ThreeXUI client from environment variables.
 * Auth mode is picked by which credentials are set:
 * - THREEXUI_API_TOKEN alone -> Bearer token auth
 * - THREEXUI_USERNAME + THREEXUI_PASSWORD -> cookie session auth
 */
function createClient(): ThreeXUI {
    const baseURL = requireEnv('THREEXUI_BASE_URL');
    const apiToken = process.env.THREEXUI_API_TOKEN;
    const panelType = (process.env.THREEXUI_PANEL_TYPE || 'auto') as 'auto' | 'modern' | 'legacy';

    // The published 3xui-api-client (from npm) still types this option as
    // `panelVersion`, though the runtime constructor reads `panelType` — fixed
    // in index.d.ts locally, pending the next npm release. Drop this cast once
    // the installed package version includes that fix.
    const panelTypeOption = { panelType } as unknown as { panelVersion: typeof panelType };

    if (apiToken) {
        return new ThreeXUI(baseURL, { token: apiToken, ...panelTypeOption });
    }

    const username = requireEnv('THREEXUI_USERNAME');
    const password = requireEnv('THREEXUI_PASSWORD');
    return new ThreeXUI(baseURL, username, password, panelTypeOption);
}

let client: ThreeXUI | undefined;

export function getClient(): ThreeXUI {
    if (!client) {
        client = createClient();
    }
    return client;
}
