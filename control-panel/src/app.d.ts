import type { Uuid } from '$lib/types';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: import('$lib/server/auth').SessionValidationResult['user'];
			session: import('$lib/server/auth').SessionValidationResult['session'];
		}
		interface PageData {
			// also edit in src/routes/+layout.server.ts
			user?: {
				uuid: Uuid;
				name: string | null;
				ghId: number;
				ghLogin: string;
			};
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
