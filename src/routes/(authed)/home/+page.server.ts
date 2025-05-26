import { db } from '$lib/server/db';
import { workspaces } from '$lib/server/db/schema';
import { docker } from '$lib/server/docker.js';
import { eq } from 'drizzle-orm';

interface DBWorkspace {
	uuid: string;
	name: string;
	ownerId: number;
	dockerId: string;
	repoURL: string;
}

interface Workspace extends DBWorkspace {
	url: string;
}

export async function load({ locals }) {
	const session = await locals.auth();

	if (!session || !session.id) {
		return { workspaces: [] };
	}

	const userWorkspaces: DBWorkspace[] = await db
		.select()
		.from(workspaces)
		.where(eq(workspaces.ownerId, session.id));

	const accessibleUserWorkspaces: Workspace[] = await Promise.all(userWorkspaces.map(async (workspace) => {
		const info = await docker.getContainer(workspace.dockerId).inspect();
		const accessUrl = `http://${info.NetworkSettings.Networks['bridge'].IPAddress}:3000/?folder=/config/workspace`;
		return {
			...workspace,
			url: accessUrl
		};
	}));

	return { workspaces: accessibleUserWorkspaces };
}
