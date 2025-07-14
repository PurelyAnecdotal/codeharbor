import { safeFetch } from '$lib/fetch';
import type { Uuid } from '$lib/types';

export const workspaceCreate = (cloneURL: string) =>
	safeFetch('/api/workspace', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ cloneURL })
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

export const userCreate = () => safeFetch('/api/user', { method: 'POST' });
