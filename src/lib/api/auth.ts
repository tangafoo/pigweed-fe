import { api, API_BASE } from './client';
import type { Session } from '@meteorclass/pigweed-contract';

// Shapes now live in the shared contract package (single source of truth,
// mirrors pigweed-be). Re-exported so existing `$lib/api/auth` imports
// keep working.
export type { Animal, Gender, SessionUser, Session } from '@meteorclass/pigweed-contract';

/** Better Auth returns null / an object without `user` when logged out. */
function parseSession(data: unknown): Session | null {
	return data && typeof data === 'object' && 'user' in data && (data as Session).user
		? (data as Session)
		: null;
}

/**
 * Client-side: resolve the session via the shared api() wrapper, which
 * sends the Better Auth cookie (`credentials: "include"`).
 */
export async function getSession(): Promise<Session | null> {
	try {
		const res = await api('/api/auth/get-session');
		if (!res.ok) return null;
		return parseSession(await res.json());
	} catch {
		// Backend down / network error — treat as logged out rather than crash.
		return null;
	}
}

export type SignInResult = { ok: true } | { ok: false; message: string };

/**
 * Sign in with email+password or username+password. Better Auth has a
 * separate endpoint per identifier kind; we pick by the presence of "@"
 * (usernames can't contain it — contract enforces 3–30 chars, no @).
 * The Set-Cookie session cookie rides back on the response because
 * api() sends `credentials: "include"`; callers must `invalidateAll()`
 * afterwards so the layout's server load re-resolves the session.
 */
export async function signIn(identifier: string, password: string): Promise<SignInResult> {
	const isEmail = identifier.includes('@');
	const path = isEmail ? '/api/auth/sign-in/email' : '/api/auth/sign-in/username';
	const body = isEmail ? { email: identifier, password } : { username: identifier, password };
	try {
		const res = await api(path, { method: 'POST', body: JSON.stringify(body) });
		if (res.ok) return { ok: true };
		// Better Auth error bodies carry a human `message`; fall back generic.
		const data = (await res.json().catch(() => null)) as { message?: string } | null;
		return { ok: false, message: data?.message ?? 'Wrong credentials. Try again.' };
	} catch {
		return { ok: false, message: 'Can’t reach the farm right now. Try again.' };
	}
}

/**
 * Server-side (layout load). The backend is a different origin (:3000),
 * so SvelteKit's fetch won't attach the browser cookie automatically —
 * forward it explicitly from the incoming request.
 */
export async function getSessionFromCookie(cookie: string): Promise<Session | null> {
	if (!cookie) return null;
	try {
		const res = await fetch(`${API_BASE}/api/auth/get-session`, {
			headers: { cookie }
		});
		if (!res.ok) return null;
		return parseSession(await res.json());
	} catch {
		return null;
	}
}
