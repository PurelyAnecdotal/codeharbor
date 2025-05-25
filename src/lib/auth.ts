import { AUTH_GITHUB_ID, AUTH_GTIHUB_SECRET } from '$env/static/private';
import { SvelteKitAuth } from '@auth/sveltekit';
import GitHub from '@auth/sveltekit/providers/github';

declare module '@auth/core/jwt' {
	interface JWT {
		accessToken?: string;
	}
}

declare module '@auth/sveltekit' {
	interface Session {
		accessToken?: string;
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
			if (account?.access_token) {
				token.accessToken = account.access_token;
			}
			return token;
		},

		session({ session, token }) {
			session.accessToken = token.accessToken;
			return session;
		}
	},
	trustHost: true
});
