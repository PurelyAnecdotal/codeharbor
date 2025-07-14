import { tagged, wrapDB, wrapOctokit } from '$lib/error';
import type { GitHubUserInfo, Uuid } from '$lib/types';
import { Octokit } from '@octokit/rest';
import { eq } from 'drizzle-orm';
import { ok, Result } from 'neverthrow';
import { db } from './server/db';
import { user } from './server/db/schema';

export const octokit = (accessToken: string) =>
	Result.fromThrowable(
		(...rest) => new Octokit(...rest),
		(err) => tagged('OctokitError', err)
	)({ auth: accessToken, userAgent: 'annex/0.0' });

export const getGitHubUserInfo = (userUuid: Uuid, accessToken: string) =>
	wrapDB(db.select({ ghId: user.ghId }).from(user).where(eq(user.uuid, userUuid)))
		.map((res) => res[0])
		.andThen((dbResult) =>
			dbResult
				? octokit(accessToken)
						.asyncAndThen((octokit) =>
							wrapOctokit(octokit.rest.users.getById({ account_id: dbResult.ghId }))
						)
						.map((res) => res.data)
						.map(({ id, login, name }): GitHubUserInfo => ({ id, login, name }))
				: ok(undefined)
		);
