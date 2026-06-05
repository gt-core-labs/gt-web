// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionUser } from '$lib/api/auth';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Session claims resolved in hooks.server.ts (null when anonymous). */
			user: SessionUser | null;
		}
		interface PageData {
			user?: SessionUser | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
