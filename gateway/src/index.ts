import { fetch } from 'bun';
import { type Context, Hono } from 'hono';
import { websocket } from 'hono/bun';
import { proxy } from 'hono/proxy';
import type { BlankInput } from 'hono/types';
import { authMiddleware } from './auth.js';
import { frontendServer, baseDomain } from './env.js';
import { proxyWebsocket, proxyWorkspace } from './proxy.js';

const port = 5110;
const workspaceSubdomainRegex =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[0-9]{1,5}$/;

export type Uuid = `${string}-${string}-${string}-${string}-${string}`;

interface Variables {
	userUuid?: Uuid;
}
export type GatewayContext = Context<{ Variables: Variables }, '*', BlankInput>;

const app = new Hono<{ Variables: Variables }>();

app.use('*', authMiddleware);

app.all('*', async (c, next) => {
	const urlObj = new URL(c.req.url);

	if (!urlObj.hostname.endsWith(baseDomain)) return c.text('Invalid host', 400);

	if (urlObj.hostname === baseDomain) {
		if (c.req.path === '/gateway' && c.req.method === 'GET') return c.text('OK');

		if (c.req.header('Upgrade') === 'websocket') return proxyWebsocket(frontendServer, c, next);

		return proxy(`http://${frontendServer}${c.req.path}${urlObj.search}`, {
			...c.req,
			customFetch: (req) => fetch(req, { redirect: 'manual' })
		});
	}

	const suffix = `.${baseDomain}`;
	const subdomain = urlObj.hostname.slice(0, -suffix.length);
	if (urlObj.hostname.endsWith(suffix) && workspaceSubdomainRegex.test(subdomain)) {
		const uuid = subdomain.split('-').slice(0, -1).join('-') as Uuid;

		const port = parseInt(subdomain.split('-').slice(-1)[0]!);
		if (port > 65535) return c.text('Invalid port', 400);

		return proxyWorkspace(uuid, port, c, next);
	}

	return c.text('Invalid host', 400);
});

export default { fetch: app.fetch, websocket, port };
