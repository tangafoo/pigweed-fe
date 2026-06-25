import { api } from './client';
import type { PublicProfile, Achievement, UserVotesResponse } from '@meteorclass/pigweed-contract';

/**
 * One earned-achievement row from GET /users/:id/achievements. The contract
 * only types the inner `Achievement`, not this granted-wrapper, so it lives here.
 */
export type EarnedAchievement = {
	grantedAt: string;
	achievement: Achievement;
};

export type VoteTarget = 'posts' | 'comments';

/**
 * In a server `load` the BE cookie must be forwarded explicitly — the backend
 * is a different origin. In the browser it rides along via `credentials: 'include'`.
 */
function cookieHeaders(cookie?: string): RequestInit | undefined {
	return cookie ? { headers: { cookie } } : undefined;
}

export async function getUserProfile(id: string, cookie?: string): Promise<PublicProfile | null> {
	try {
		const res = await api(`/users/${encodeURIComponent(id)}`, cookieHeaders(cookie));
		if (!res.ok) return null;
		return (await res.json()) as PublicProfile;
	} catch {
		return null;
	}
}

export async function getUserAchievements(
	id: string,
	cookie?: string
): Promise<EarnedAchievement[]> {
	try {
		const res = await api(`/users/${encodeURIComponent(id)}/achievements`, cookieHeaders(cookie));
		if (!res.ok) return [];
		const data = (await res.json()) as { achievements?: EarnedAchievement[] };
		return data.achievements ?? [];
	} catch {
		return [];
	}
}

/**
 * The full achievement catalog (every active achievement) — GET /achievements.
 * The profile "View all" modal cross-references this against the user's earned
 * list to show locked vs unlocked. Public; returns [] on failure.
 */
export async function getAchievementCatalog(cookie?: string): Promise<Achievement[]> {
	try {
		const res = await api('/achievements', cookieHeaders(cookie));
		if (!res.ok) return [];
		const data = (await res.json()) as { achievements?: Achievement[] };
		return data.achievements ?? [];
	} catch {
		return [];
	}
}

export async function getUserVotes(
	id: string,
	target: VoteTarget,
	page = 1,
	limit = 10,
	cookie?: string
): Promise<UserVotesResponse | null> {
	try {
		const qs = new URLSearchParams({ target, page: String(page), limit: String(limit) });
		const res = await api(`/users/${encodeURIComponent(id)}/votes?${qs}`, cookieHeaders(cookie));
		if (!res.ok) return null;
		return (await res.json()) as UserVotesResponse;
	} catch {
		return null;
	}
}
