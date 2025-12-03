import type { WorkspaceCreateOptions } from '$lib/server/workspaces';
import { letterRegex, nameRegex } from '$lib/types';
import { ResultAsync } from 'neverthrow';
import { toast } from 'svelte-sonner';

export const safeFetch = (input: RequestInfo | URL, init?: BunFetchRequestInit) =>
	ResultAsync.fromPromise(fetch(input, init), (e) => e as DOMException | TypeError);

export const setName = async (name: string) => {
	if (name.length < 5 || name.length > 30) {
		toast.error('Name must be between 5 and 30 characters long');
		return;
	}

	if (!nameRegex.test(name)) {
		toast.error('Name can only contain letters, special characters, and spaces');
		return;
	}

	if (!letterRegex.test(name)) {
		toast.error('Name must contain at least one letter');
		return;
	}

	await safeFetch('/api/user/setname', { method: 'POST', body: name }).match(
		async (resp) => {
			if (resp.ok) {
				location.assign('/workspaces');
			} else {
				toast.error('Failed to set name', { description: await resp.text() });
			}
		},
		(err) => toast.error('Failed to set Name', { description: err.message })
	);
};
