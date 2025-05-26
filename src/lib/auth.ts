import { AUTH_GITHUB_ID, AUTH_GTIHUB_SECRET } from '$env/static/private';
import { SvelteKitAuth } from '@auth/sveltekit';
import GitHub from '@auth/sveltekit/providers/github';

declare module '@auth/core/jwt' {
	interface JWT {
		accessToken?: string;
		id?: number;
	}
}

declare module '@auth/sveltekit' {
	interface Session {
		accessToken?: string;
		id?: number;
	}
}

export const { handle, signIn, signOut } = SvelteKitAuth({
	providers: [
		GitHub({
			clientId: AUTH_GITHUB_ID,
			clientSecret: AUTH_GTIHUB_SECRET,
			authorization: {
				params: {
					scope: 'repo'
				}
			}
		})
	],
	callbacks: {
		jwt({ token, account }) {
			if (account?.access_token) token.accessToken = account.access_token;
			if (account?.providerAccountId) token.id = parseInt(account.providerAccountId);
			return token;
		},

		session({ session, token }) {
			session.accessToken = token.accessToken;
			session.id = token.id;
			return session;
		},
	},
	trustHost: true
});
