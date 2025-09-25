import type { TemplateCreateOptions } from '$lib/server/templates';
import type { WorkspaceCreateOptions } from '$lib/server/workspaces';
import { letterRegex, nameRegex, type Uuid } from '$lib/types';
import { ResultAsync } from 'neverthrow';
import { toast } from 'svelte-sonner';

export const safeFetch = (input: RequestInfo | URL, init?: RequestInit) =>
	ResultAsync.fromPromise(fetch(input, init), (e) => e as DOMException | TypeError);

export const workspaceCreate = (options: WorkspaceCreateOptions) =>
	safeFetch('/api/workspace', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(options)
	});

export const workspaceDelete = (uuid: Uuid) =>
	safeFetch(`/api/workspace/${uuid}`, { method: 'DELETE' });

export const workspaceStart = (uuid: Uuid) =>
	safeFetch(`/api/workspace/${uuid}/start`, { method: 'POST' });

export const workspaceStop = (uuid: Uuid) =>
	safeFetch(`/api/workspace/${uuid}/stop`, { method: 'POST' });

export const workspaceShare = (uuid: Uuid, userUUID: Uuid) =>
	safeFetch(`/api/workspace/${uuid}/access/${userUUID}`, { method: 'PUT' });

export const workspaceUnshare = (uuid: Uuid, userUUID: Uuid) =>
	safeFetch(`/api/workspace/${uuid}/access/${userUUID}`, { method: 'DELETE' });

export const workspaceStats = (uuid: Uuid) =>
	safeFetch(`/api/workspace/${uuid}/usage`, { method: 'GET' });

export const userCreate = () => safeFetch('/api/user', { method: 'POST' });

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

export const templateCreate = (options: TemplateCreateOptions) =>
	safeFetch('/api/template', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(options)
	});
