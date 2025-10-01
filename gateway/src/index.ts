import { fetch } from 'bun';
import Dockerode from 'dockerode';
import { eq } from 'drizzle-orm';
import { type Context, Hono, type Next } from 'hono';
import { upgradeWebSocket, websocket } from 'hono/bun';
import { getCookie } from 'hono/cookie';
import { proxy } from 'hono/proxy';
import type { BlankInput } from 'hono/types';
import { authMiddleware, sessionCookieName } from './auth.js';
import { db } from './db.js';
import { workspaces } from './schema.js';

const rootDomain = process.env.BASE_DOMAIN ?? 'codeharbor.localhost';
const port = 5110;
const frontendServer = process.env.CONTROL_PANEL_HOST ?? 'localhost:5173';

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

interface Variables {
	userUuid?: Uuid;
}

const app = new Hono<{ Variables: Variables }>();

type C = Context<{ Variables: Variables }, '*', BlankInput>;

app.use('*', authMiddleware);

const docker = new Dockerode();

const workspaceSubdomainRegex =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[0-9]{1,5}$/;

app.all('*', async (c, next) => {
	const urlObj = new URL(c.req.url);

	if (!urlObj.hostname.endsWith(rootDomain)) return c.text('Invalid host', 400);

	if (urlObj.hostname === rootDomain) {
		if (c.req.path === '/gateway' && c.req.method === 'GET') return c.text('OK');

		if (c.req.header('Upgrade') === 'websocket') return proxyWebsocket(frontendServer, c, next);

		return proxy(`http://${frontendServer}${c.req.path}${urlObj.search}`, {
			...c.req,
			customFetch: (req) => fetch(req, { redirect: 'manual' })
		});
	}

	const suffix = `.${rootDomain}`;
	const subdomain = urlObj.hostname.slice(0, -suffix.length);
	if (urlObj.hostname.endsWith(suffix) && workspaceSubdomainRegex.test(subdomain)) {
		const uuid = subdomain.split('-').slice(0, -1).join('-') as Uuid;

		const port = parseInt(subdomain.split('-').slice(-1)[0]!);
		if (port > 65535) return c.text('Invalid port', 400);

		return proxyWorkspace(uuid, port, c, next);
	}

	return c.text('Invalid host', 400);
});

async function proxyWorkspace(uuid: Uuid, port: number, c: C, next: Next) {
	if (!db) return c.text('Database is not initialized', 500);

	const [workspace] = await db.select().from(workspaces).where(eq(workspaces.uuid, uuid));
	if (!workspace) return c.text('Workspace not found', 404);

	const userUuid = c.get('userUuid');
	if (!userUuid) return c.text('Unauthorized', 401);

	try {
		const hasAccess = await (
			await fetch(`http://${frontendServer}/api/workspace/${uuid}/hasaccess`, {
				headers: {
					Cookie: `${sessionCookieName}=${getCookie(c, sessionCookieName)}`
				}
			})
		).text();

		if (hasAccess !== 'true') {
			if (hasAccess === 'false') return c.text('Forbidden', 403);
			return c.text(`Error checking workspace access:\n${hasAccess}`, 500);
		}
	} catch (e) {
		console.error(e);
		return c.text('Error checking workspace access', 500);
	}

	let data: Dockerode.ContainerInspectInfo;
	try {
		data = await docker.getContainer(workspace.dockerId).inspect(); // TODO: cache this
	} catch (e) {
		console.error(e);
		return c.text('Error inspecting docker container', 500);
	}

	const bridge = data.NetworkSettings.Networks['bridge'];
	if (!bridge) return c.text('Bridge network not found', 500);

	const containerHost = `${bridge.IPAddress}:${port}`;

	if (c.req.header('Upgrade') === 'websocket') return proxyWebsocket(containerHost, c, next);

	const urlObj = new URL(c.req.url);

	return proxy(`http://${containerHost}${c.req.path}${urlObj.search}`, {
		...c.req,
		customFetch: (req) => fetch(req, { redirect: 'manual' })
	});
}

const proxyWebsocket = (destHost: string, c: C, next: Next) =>
	upgradeWebSocket((c) => {
		const search = new URL(c.req.url).search;

		const protocol = c.req.header('Sec-WebSocket-Protocol');

		const serverWs = new WebSocket(`ws://${destHost}${c.req.path}${search}`, protocol);

		const serverWsReady: Promise<Event> = new Promise((resolve) => {
			serverWs.addEventListener('open', (event) => {
				resolve(event);
			});
		});

		return {
			onOpen(_event, clientWs) {
				serverWs.addEventListener('message', (event) => {
					if (clientWs.readyState === WebSocket.OPEN) clientWs.send(event.data);
				});

				serverWs.addEventListener('close', ({ code, reason }) => {
					clientWs.close(code, reason);
				});

				serverWs.addEventListener('error', () => {
					clientWs.close(1014, 'proxied ws error');
				});
			},

			async onMessage({ data }) {
				await serverWsReady;
				if (serverWs.readyState === WebSocket.OPEN)
					serverWs.send(data instanceof Blob ? await data.arrayBuffer() : data);
			},

			onClose({ code, reason }) {
				serverWs.close(code, reason);
			},

			onError() {
				serverWs.close(1014, 'client ws error');
			}
		};
	})(c, next);

export default { fetch: app.fetch, websocket, port };
