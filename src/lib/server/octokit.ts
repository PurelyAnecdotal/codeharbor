import { tagged, wrapDB, wrapOctokit } from '$lib/error';
import type { GitHubUserInfo, Uuid } from '$lib/types';
import { Octokit } from '@octokit/rest';
import { eq } from 'drizzle-orm';
import { ok, Result, ResultAsync } from 'neverthrow';
import { db } from './db';
import { users } from './db/schema';

export const initOctokit = (accessToken: string) =>
	Result.fromThrowable(
		(...rest) => new Octokit(...rest),
		(err) => tagged('OctokitInitError', err)
	)({ auth: accessToken, userAgent: 'annex/0.0' });

export const getGitHubUserInfo = (userUuid: Uuid, octokit: Octokit) =>
	wrapDB(db.select({ ghId: users.ghId }).from(users).where(eq(users.uuid, userUuid)))
		.map((res) => res[0])
		.andThen((dbResult) =>
			dbResult
				? wrapOctokit(octokit.rest.users.getById({ account_id: dbResult.ghId }))
						.map((res) => res.data)
						.map(({ id, login, name }): GitHubUserInfo => ({ id, login, name }))
				: ok(undefined)
		);

export const getUserGitHubRepos = (octokit: Octokit) =>
	ResultAsync.fromPromise(octokit.rest.repos.listForAuthenticatedUser(), (err) =>
		tagged('OctokitError', err)
	).map((res) => res.data);
