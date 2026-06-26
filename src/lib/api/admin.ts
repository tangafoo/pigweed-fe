import { api, API_BASE } from './client';
import type {
	AdminUsersResponse,
	AdminStats,
	AdminPlansResponse,
	SubscriptionBenefit
} from '@meteorclass/pigweed-contract';

/**
 * The data seam for the admin panel. Every call rides the cookie `api()`
 * wrapper; the BE gates them on `User.isAdmin` (401/403 otherwise). Reads can
 * take the SvelteKit `load` `fetch` (+ forwarded cookie) for SSR; writes run
 * client-side from the panel.
 */

// ─── Reads ──────────────────────────────────────────────────────────
async function getJson<T>(
	path: string,
	fallback: T,
	fetchImpl?: typeof globalThis.fetch,
	cookie?: string
): Promise<{ ok: boolean; status: number; data: T }> {
	try {
		const res = fetchImpl
			? await fetchImpl(`${API_BASE}${path}`, {
					credentials: 'include',
					headers: cookie ? { cookie } : undefined
				})
			: await api(path);
		if (!res.ok) return { ok: false, status: res.status, data: fallback };
		return { ok: true, status: res.status, data: (await res.json()) as T };
	} catch {
		return { ok: false, status: 0, data: fallback };
	}
}

export const fetchAdminUsers = (q: string, page: number, fetchImpl?: typeof globalThis.fetch, cookie?: string) => {
	const qs = new URLSearchParams({ page: String(page), limit: '50' });
	if (q) qs.set('q', q);
	return getJson<AdminUsersResponse>(
		`/admin/users?${qs}`,
		{ users: [], page, limit: 50, total: 0 },
		fetchImpl,
		cookie
	);
};

export const fetchAdminStats = (fetchImpl?: typeof globalThis.fetch, cookie?: string) =>
	getJson<AdminStats>(
		'/admin/stats',
		{ totalUsers: 0, activeSubscribers: 0, totalPosts: 0, totalReviews: 0 },
		fetchImpl,
		cookie
	);

export const fetchAdminPlans = (fetchImpl?: typeof globalThis.fetch, cookie?: string) =>
	getJson<AdminPlansResponse>('/admin/plans', { plans: [] }, fetchImpl, cookie);

export const fetchAdminBenefits = (fetchImpl?: typeof globalThis.fetch, cookie?: string) =>
	getJson<{ benefits: (SubscriptionBenefit & { active: boolean })[] }>(
		'/admin/benefits',
		{ benefits: [] },
		fetchImpl,
		cookie
	);

// ─── Writes ─────────────────────────────────────────────────────────
async function send(path: string, method: string, body?: unknown): Promise<boolean> {
	const res = await api(path, {
		method,
		...(body !== undefined ? { body: JSON.stringify(body) } : {})
	});
	return res.ok;
}

export const subscribeUserTier = (
	userId: string,
	planId: string,
	opts: { startedAt?: string; deliveryDay?: number } = {}
) => send(`/admin/users/${userId}/subscribe`, 'POST', { planId, ...opts });

export const unsubscribeUser = (userId: string) =>
	send(`/admin/users/${userId}/unsubscribe`, 'POST');
export const pauseUser = (userId: string) => send(`/admin/users/${userId}/pause`, 'POST');
export const resumeUser = (userId: string) => send(`/admin/users/${userId}/resume`, 'POST');

export const setUserFlags = (
	userId: string,
	flags: { isFoundingFlock?: boolean; isFarmOwner?: boolean; isAdmin?: boolean }
) => send(`/admin/users/${userId}/flags`, 'PATCH', flags);

export const createBenefit = (label: string, sortOrder: number) =>
	send('/admin/benefits', 'POST', { label, sortOrder });
export const updateBenefit = (
	id: string,
	patch: { label?: string; sortOrder?: number; active?: boolean }
) => send(`/admin/benefits/${id}`, 'PATCH', patch);
export const deleteBenefit = (id: string) => send(`/admin/benefits/${id}`, 'DELETE');

export const setPlanBenefits = (planId: string, benefitIds: string[]) =>
	send(`/admin/plans/${planId}/benefits`, 'PUT', { benefitIds });
