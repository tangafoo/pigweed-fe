import { api } from './client';

export type Animal = 'CHICKEN' | 'DOG' | 'GOOSE';
export type Gender = 'MALE' | 'FEMALE' | 'NONBINARY' | 'UNDISCLOSED';

/**
 * The signed-in user. Better Auth's get-session returns all of this in
 * one call (additionalFields), so the nav/profile needs no extra fetch.
 */
export interface SessionUser {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	username: string;
	gender: Gender;
	animal: Animal;
	avatarSeed: number;
	coinBalance: number;
	unlockCoins: number;
}

export interface Session {
	user: SessionUser;
	session: { id: string; expiresAt: string };
}

/**
 * Resolve the current session from the Better Auth cookie.
 * Returns null when nobody is logged in (no cookie / expired).
 */
export async function getSession(): Promise<Session | null> {
	try {
		const res = await api('/api/auth/get-session');
		if (!res.ok) return null;
		const data = await res.json();
		// Better Auth returns null/empty body when unauthenticated.
		return data && data.user ? (data as Session) : null;
	} catch {
		// Backend down / network error — treat as logged out rather than crash.
		return null;
	}
}
