import type { ServerInit } from '@sveltejs/kit';

export { handle } from '$lib/auth';

export const init: ServerInit = () => {
	if (typeof Bun === 'undefined')
		throw new Error('Bun is not defined. Ensure you are running with --bun.');
};
