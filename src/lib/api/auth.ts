import { api, API_BASE } from './client';
import type { Session, Animal, Gender } from '@meteorclass/pigweed-contract';

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

export type SignUpInput = {
	email: string;
	username: string;
	password: string;
	gender: Gender;
};
export type SignUpResult =
	| { ok: true }
	| { ok: false; message: string; field?: 'username' };

/**
 * Create an account. Better Auth requires a `name`; pigweed is
 * pseudonymous and only ever surfaces `username`, so we reuse it for
 * `name` (email is the real identifier). `animal` + `avatarSeed` are
 * assigned server-side at signup — never sent. On success Better Auth
 * signs the user in (Set-Cookie rides back via api()'s
 * `credentials: "include"`); callers must `invalidateAll()` after.
 * Contract-specific username errors are mapped to `field: 'username'`
 * so the form can render them inline.
 */
export async function signUp(input: SignUpInput): Promise<SignUpResult> {
	const body = {
		email: input.email,
		password: input.password,
		username: input.username,
		gender: input.gender,
		name: input.username
	};
	try {
		const res = await api('/api/auth/sign-up/email', {
			method: 'POST',
			body: JSON.stringify(body)
		});
		if (res.ok) return { ok: true };
		const data = (await res.json().catch(() => null)) as
			| { code?: string; message?: string }
			| null;
		const code = data?.code ?? '';
		if (code.includes('USERNAME')) {
			const message =
				code === 'USERNAME_IS_ALREADY_TAKEN'
					? 'That name is taken — try another.'
					: code === 'USERNAME_TOO_SHORT'
						? 'Username is too short (min 3).'
						: code === 'USERNAME_TOO_LONG'
							? 'Username is too long (max 30).'
							: (data?.message ?? 'Pick a different username.');
			return { ok: false, message, field: 'username' };
		}
		return { ok: false, message: data?.message ?? 'Could not hatch your animal. Try again.' };
	} catch {
		return { ok: false, message: 'Can’t reach the farm right now. Try again.' };
	}
}

/**
 * Live username check for the signup form. Better Auth's username plugin
 * answers `{ available: boolean }`. Returns `null` when we can't tell
 * (network/parse) so the UI degrades to "let the server decide" rather
 * than blocking submit on a false negative.
 */
export async function isUsernameAvailable(username: string): Promise<boolean | null> {
	try {
		const res = await api(
			`/api/auth/is-username-available?username=${encodeURIComponent(username)}`
		);
		if (!res.ok) return null;
		const data = (await res.json().catch(() => null)) as { available?: boolean } | null;
		return typeof data?.available === 'boolean' ? data.available : null;
	} catch {
		return null;
	}
}

/**
 * Reroll the signed-in user's animal + avatarSeed. There is no "save"
 * button in this product: this POST itself persists the new pair to the
 * account server-side, immediately and irreversibly — clicking reroll IS
 * the act of choosing (per both CLAUDE.md briefs). No shared-contract
 * type for the response, so it's typed inline against contract `Animal`.
 */
export async function rerollAvatar(): Promise<{ animal: Animal; avatarSeed: number } | null> {
	try {
		const res = await api('/users/me/avatar/reroll', { method: 'POST' });
		if (!res.ok) return null;
		const data = (await res.json().catch(() => null)) as
			| { animal?: Animal; avatarSeed?: number }
			| null;
		return data && data.animal && typeof data.avatarSeed === 'number'
			? { animal: data.animal, avatarSeed: data.avatarSeed }
			: null;
	} catch {
		return null;
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
