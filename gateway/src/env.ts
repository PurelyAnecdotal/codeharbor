export const baseDomain = process.env.BASE_DOMAIN ?? 'codeharbor.localhost';
export const frontendServer = process.env.CONTROL_PANEL_HOST ?? 'localhost:5173';
export const inContainer = process.env.GATEWAY_IN_CONTAINER === 'true';
export const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? 'auth-session';
