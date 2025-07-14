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
			user?: {
				ghLogin: string;
				ghName: string | null;
			};
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
