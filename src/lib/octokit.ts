import { Octokit } from '@octokit/rest';
import { Result, ResultAsync } from 'neverthrow';
import { tagged } from './error';

export const octokit = (accessToken: string) =>
	Result.fromThrowable(
		(...rest) => new Octokit(...rest),
		(err) => tagged('OctokitError', err)
	)({ auth: accessToken, userAgent: 'annex/0.0' });

export const getGitHubUsername = (id: number, accessToken: string) =>
	octokit(accessToken)
		.asyncAndThen((octokit) =>
			ResultAsync.fromPromise(octokit.rest.users.getById({ account_id: id }), (err) =>
				tagged('OctokitError', err)
			)
		)
		.map((res) => ({ name: res.data.name, login: res.data.login }));
