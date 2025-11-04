import type { Next } from "hono";
import { upgradeWebSocket } from "hono/bun";
import { type GatewayContext, type Uuid } from "./index.js";
import { proxy } from "hono/proxy";
import { frontendServer, inContainer } from "./env.js";

export async function proxyWorkspace(uuid: Uuid, port: number, c: GatewayContext, next: Next) {
	const searchParams = new URLSearchParams({ inContainer: inContainer.toString() });
	const res = await fetch(
		`http://${frontendServer}/api/workspace/${uuid}/hostname?${searchParams}`
	);
	const text = await res.text();
	if (res.status !== 200) return c.text(text, res.status as any);

	const urlObj = new URL(c.req.url);
	const containerHost = `${text}:${port}`;

	if (c.req.header('Upgrade') === 'websocket') return proxyWebsocket(containerHost, c, next);

	return proxy(`http://${containerHost}${c.req.path}${urlObj.search}`, {
		...c.req,
		customFetch: (req) => fetch(req, { redirect: 'manual' })
	});
}

export const proxyWebsocket = (destHost: string, c: GatewayContext, next: Next) =>
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