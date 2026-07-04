import { createAuthClient } from 'better-auth/svelte';
import { passkeyClient } from '@better-auth/passkey/client';
import { usernameClient, magicLinkClient, emailOTPClient } from 'better-auth/client/plugins';
import { api, API_BASE } from './client';
import type { Session, Animal, Gender, MyEggStats } from '@meteorclass/pigweed-contract';

// Shapes live in the shared contract package (single source of truth,
// mirrors pigweed-be). Re-exported so existing `$lib/api/auth` imports
// keep working.
export type { Animal, Gender, SessionUser, Session } from '@meteorclass/pigweed-contract';

/**
 * Single Better Auth client for the whole FE. All auth ceremonies route
 * through here — email/username sign-in, session lookup, passkey
 * register/authenticate/list/delete. Signup + bespoke endpoints stay on
 * the raw api() wrapper because they hit non-Better-Auth surfaces (or
 * require error-code mapping the client doesn't expose).
 *
 * Cookies are handled automatically: the client uses fetch with
 * `credentials: "include"` against API_BASE.
 */
export const authClient = createAuthClient({
	baseURL: API_BASE,
	plugins: [usernameClient(), passkeyClient(), magicLinkClient(), emailOTPClient()]
});

function parseSession(data: unknown): Session | null {
	return data && typeof data === 'object' && 'user' in data && (data as Session).user
		? (data as Session)
		: null;
}

/**
 * Resolve the current session. Routes through Better Auth's client so
 * cookie handling, error shape, and future SDK changes stay consistent.
 */
export async function getSession(): Promise<Session | null> {
	try {
		const { data } = await authClient.getSession();
		return parseSession(data);
	} catch {
		// Backend down / network error — treat as logged out rather than crash.
		return null;
	}
}

export type SignInResult = { ok: true } | { ok: false; message: string };

/**
 * Sign in with email+password or username+password. Better Auth has a
 * separate method per identifier kind; we pick by the presence of "@"
 * (usernames can't contain it — contract enforces 3–30 chars, no @).
 * The session cookie rides back on the response; callers must
 * `invalidateAll()` afterwards so the layout's server load re-resolves.
 */
export async function signIn(identifier: string, password: string): Promise<SignInResult> {
	const isEmail = identifier.includes('@');
	try {
		const { error } = isEmail
			? await authClient.signIn.email({ email: identifier, password })
			: await authClient.signIn.username({ username: identifier, password });
		if (!error) return { ok: true };
		return { ok: false, message: error.message ?? 'Wrong credentials. Try again.' };
	} catch (e) {
		console.error('[auth] signIn network failure:', e);
		return { ok: false, message: 'Can’t reach the farm right now. Try again.' };
	}
}

export type MagicLinkResult = { ok: true } | { ok: false; reason: 'rate-limited' | 'error' };

/**
 * Email the user a one-click sign-in link (passwordless). The BE always
 * answers 200 whether or not the email has an account (no enumeration), so
 * `ok: true` means "sent if it exists" — word the success copy accordingly.
 * The link hits the BE's /magic-link/verify, sets the session cookie, and
 * redirects: success → `/`, failure (expired / used / unknown email) → back
 * to /login with `?error=INVALID_TOKEN|EXPIRED_TOKEN|new_user_signup_disabled`
 * for the page to translate. Rate-limited to 3/min per IP on the BE.
 */
export async function sendMagicLink(email: string): Promise<MagicLinkResult> {
	try {
		const origin = window.location.origin;
		const { error } = await authClient.signIn.magicLink({
			email,
			callbackURL: `${origin}/`,
			errorCallbackURL: `${origin}/login`
		});
		if (!error) return { ok: true };
		return { ok: false, reason: error.status === 429 ? 'rate-limited' : 'error' };
	} catch (e) {
		console.error('[auth] sendMagicLink network failure:', e);
		return { ok: false, reason: 'error' };
	}
}

/**
 * Whether the signed-in user has a password. `listAccounts()` lists Better
 * Auth's `account`-table rows — the provider links (a `credential` row holds
 * the password hash; OAuth would add its own). It is NOT the pigweed `user`
 * row: magic-link-onboarded customers (admin "Add user") ARE full users
 * (username, avatar, etc.) but have no `account` row at all — nobody ever set
 * a password for them — so `credential` is absent and we show the "set a
 * password" banner. A normal email+password signup has both a user row and a
 * `credential` account. `null` = couldn't tell (network) — treat as "don't nag".
 */
export async function hasPassword(): Promise<boolean | null> {
	try {
		const { data, error } = await authClient.listAccounts();
		if (error || !Array.isArray(data)) return null;
		return data.some((a) => a.providerId === 'credential');
	} catch {
		return null;
	}
}

export type SetPasswordResult = { ok: true } | { ok: false; reason: 'too-short' | 'error' };

/**
 * Bootstrap a password onto a passwordless (magic-link) account via the
 * BE's /users/me/set-password. The BE refuses (409) when a password
 * already exists — this can only ever ADD one, never change one.
 */
export async function setPassword(newPassword: string): Promise<SetPasswordResult> {
	try {
		const res = await api('/users/me/set-password', {
			method: 'POST',
			body: JSON.stringify({ newPassword })
		});
		if (res.ok) return { ok: true };
		const data = (await res.json().catch(() => null)) as { code?: string } | null;
		return { ok: false, reason: data?.code === 'PASSWORD_TOO_SHORT' ? 'too-short' : 'error' };
	} catch (e) {
		console.error('[auth] setPassword network failure:', e);
		return { ok: false, reason: 'error' };
	}
}

export type SignUpInput = {
	email: string;
	username: string;
	password: string;
	gender: Gender;
	/** Optional contact number. */
	phoneNumber?: string;
};
export type SignUpResult = { ok: true } | { ok: false; message: string; field?: 'username' };

/**
 * Create an account. Better Auth requires a `name`; pigweed is
 * pseudonymous and only ever surfaces `username`, so we reuse it for
 * `name` (email is the real identifier). `animal` + `avatarSeed` are
 * assigned server-side at signup — never sent. On success Better Auth
 * signs the user in (Set-Cookie rides back via the client); callers
 * must `invalidateAll()` after. Contract-specific username errors are
 * mapped to `field: 'username'` so the form can render them inline.
 */
export async function signUp(input: SignUpInput): Promise<SignUpResult> {
	try {
		// `gender` is a pigweed additional field — the BE's Better Auth
		// config maps it onto the user row; the client passes it through.
		const { error } = await authClient.signUp.email({
			email: input.email,
			password: input.password,
			name: input.username,
			username: input.username,
			gender: input.gender,
			...(input.phoneNumber ? { phoneNumber: input.phoneNumber } : {})
		} as Parameters<typeof authClient.signUp.email>[0]);
		if (!error) return { ok: true };
		const code = error.code ?? '';
		if (code.includes('USERNAME')) {
			const message =
				code === 'USERNAME_IS_ALREADY_TAKEN'
					? 'That name is taken — try another.'
					: code === 'USERNAME_TOO_SHORT'
						? 'Username is too short (min 3).'
						: code === 'USERNAME_TOO_LONG'
							? 'Username is too long (max 30).'
							: (error.message ?? 'Pick a different username.');
			return { ok: false, message, field: 'username' };
		}
		return { ok: false, message: error.message ?? 'Could not hatch your animal. Try again.' };
	} catch (e) {
		// True network-level failure (CORS block, extension/ad-blocker, wrong
		// API base URL) — the request never got an HTTP answer. Log the real
		// error so "can't reach the farm" reports are debuggable in prod.
		console.error('[auth] signUp network failure:', e);
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
		const { data, error } = await authClient.isUsernameAvailable({ username });
		if (error) return null;
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
export async function rerollAvatar(
	limited = false
): Promise<{ animal: Animal; avatarSeed: number } | { error: 'limit' } | null> {
	try {
		const res = await api(`/users/me/avatar/reroll${limited ? '?limited=1' : ''}`, {
			method: 'POST'
		});
		// 403 = the once-only settings reroll is used up.
		if (res.status === 403) return { error: 'limit' };
		if (!res.ok) return null;
		const data = (await res.json().catch(() => null)) as {
			animal?: Animal;
			avatarSeed?: number;
		} | null;
		return data && data.animal && typeof data.avatarSeed === 'number'
			? { animal: data.animal, avatarSeed: data.avatarSeed }
			: null;
	} catch {
		return null;
	}
}

/**
 * Update the signed-in user's gender (the one mutable identity field —
 * username/email are immutable). Goes through Better Auth's updateUser, which
 * accepts `gender` because it's an `input: true` additionalField. Returns
 * whether it stuck; callers invalidate the session to repaint.
 */
export async function updateGender(gender: Gender): Promise<boolean> {
	try {
		// `gender` is a server-side additionalField; the client's updateUser type
		// is inferred without it, so cast through a loose signature.
		const update = authClient.updateUser as unknown as (
			input: Record<string, unknown>
		) => Promise<{ error?: unknown }>;
		const res = await update({ gender });
		return !res?.error;
	} catch {
		return false;
	}
}

/**
 * Update the signed-in user's optional phone number (no verification). Empty
 * string clears it. Same `updateUser` route as gender (a `phoneNumber`
 * additionalField).
 */
export async function updatePhone(phoneNumber: string): Promise<boolean> {
	try {
		const update = authClient.updateUser as unknown as (
			input: Record<string, unknown>
		) => Promise<{ error?: unknown }>;
		const res = await update({ phoneNumber });
		return !res?.error;
	} catch {
		return false;
	}
}

/** The signed-in user's own egg-ledger rollup (eggs eaten + last order). */
export async function fetchMyEggStats(): Promise<MyEggStats | null> {
	try {
		const res = await api('/users/me/egg-stats');
		if (!res.ok) return null;
		return (await res.json()) as MyEggStats;
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
