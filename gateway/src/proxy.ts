import type { Next } from 'hono';
import { upgradeWebSocket } from 'hono/bun';
import { getCookie } from 'hono/cookie';
import { proxy } from 'hono/proxy';
import { frontendServer, inContainer, sessionCookieName } from './env.js';
import { type GatewayContext, type Uuid } from './index.js';

export async function proxyWorkspace(uuid: Uuid, port: number, c: GatewayContext, next: Next) {
	const sessionToken = getCookie(c, sessionCookieName);

	const searchParams = new URLSearchParams({ inContainer: inContainer.toString() });
	const res = await fetch(
		`http://${frontendServer}/api/workspace/${uuid}/hostname?${searchParams}`,
		{ headers: { cookie: `${sessionCookieName}=${sessionToken}` } }
	);

	const text = await res.text();
	if (res.status !== 200) {
		if (text === 'Container is not running')
			return c.text('Workspace is not running', res.status as any);

		return c.text(`Failed to retrieve workspace hostname: ${text}`, res.status as any);
	}

	const urlObj = new URL(c.req.url);
	const containerHost = `${text}:${port}`;

	const touch = () => touchWorkspace(uuid, sessionToken!);

	touch();

	if (c.req.header('Upgrade') === 'websocket') return proxyWebsocket(containerHost, c, next, touch);

	try {
		return await proxy(`http://${containerHost}${c.req.path}${urlObj.search}`, {
			...c.req,
			customFetch: (req) => fetch(req, { redirect: 'manual' })
		});
	} catch (err) {
		return c.text(`Failed to proxy request to workspace container: ${err}`, 502);
	}
}

export const proxyWebsocket = (
	destHost: string,
	c: GatewayContext,
	next: Next,
	onClientMessage: () => any
) =>
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
				if (serverWs.readyState === WebSocket.OPEN) {
					onClientMessage();
					serverWs.send(data instanceof Blob ? await data.arrayBuffer() : data);
				}
			},

			onClose({ code, reason }) {
				serverWs.close(code, reason);
			},

			onError() {
				serverWs.close(1014, 'client ws error');
			}
		};
	})(c, next);

const touchWorkspace = (workspaceUuid: Uuid, sessionToken: string) =>
	fetch(`http://${frontendServer}/api/workspace/${workspaceUuid}/last-accessed`, {
		method: 'PATCH',
		headers: { cookie: `${sessionCookieName}=${sessionToken}` }
	}).catch((err) =>
		console.error(`Failed to update lastAccessedAt time for workspace ${workspaceUuid}:`, err)
	);
