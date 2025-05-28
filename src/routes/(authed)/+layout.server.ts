import { requireLogin } from '$lib/auth';

export async function load() {
	await requireLogin();
}
