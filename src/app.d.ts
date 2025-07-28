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
				ghId: number;
				ghLogin: string;
				ghName: string | null;
			};
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
