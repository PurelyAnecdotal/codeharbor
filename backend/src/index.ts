import GitHub from '@auth/core/providers/github';
import { initAuthConfig } from '@hono/auth-js';
import type { ServerWebSocket } from 'bun';
import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { proxy } from 'hono/proxy';

const app = new Hono();

const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>();

app.use(
	'*',
	initAuthConfig((c) => ({
		secret: c.env.AUTH_SECRET,
		providers: [
			GitHub({
				clientId: c.env.GITHUB_ID,
				clientSecret: c.env.GITHUB_SECRET
			})
		]
	}))
);

// app.use('/api/auth/*', authHandler());

// app.use('/api/*', verifyAuth());

// app.get('/api/protected', (c) => {
// 	const auth = c.get('authUser');
// 	return c.json(auth);
// });

app.get('/', (c) => c.text('Hono!'));

const originServer = '172.17.0.2:3000';

app.get('/instance', () => proxy(`http://${originServer}/instance`));

app.get(
	'/instance/*',
	upgradeWebSocket((c) => {
		const targetWs = new WebSocket(`ws://${originServer}/${c.req.path}`);

		return {
			onOpen(_event, ws) {
				targetWs.addEventListener('message', (event) => {
					ws.send(event.data);
				});

				targetWs.addEventListener('close', ({ code, reason }) => ws.close(code, reason));

				targetWs.addEventListener('error', () => ws.close(1014, 'proxied ws error'));
			},

			onMessage(event) {
				targetWs.send(event.data);
			},

			onClose({ code, reason }) {
				targetWs.close(code, reason);
			},

			onError() {
				targetWs.close(1014, 'client ws error');
			}
		};
	})
);

app.get('/instance/*', (c) => proxy(`http://${originServer}/${c.req.path}`));

export default {
	fetch: app.fetch,
	websocket
};
