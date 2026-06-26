import { api, API_BASE } from './client';
import type {
	AdminUsersResponse,
	AdminStats,
	AdminPlansResponse,
	SubscriptionBenefit,
	EggOrder
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

export const fetchAdminUsers = (
	q: string,
	page: number,
	orderedOn: string,
	fetchImpl?: typeof globalThis.fetch,
	cookie?: string
) => {
	const qs = new URLSearchParams({ page: String(page), limit: '50' });
	if (q) qs.set('q', q);
	if (orderedOn) qs.set('orderedOn', orderedOn);
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

// Pre-register a user from an email + send a magic link. Returns the assigned
// identity (username + animal) so the modal can confirm what they were given.
export async function registerUser(input: {
	email: string;
	username?: string;
	gender?: string;
	animal?: string;
}): Promise<{ username: string; animal: string; existed: boolean } | { error: string }> {
	let res: Response;
	try {
		res = await api('/admin/users', { method: 'POST', body: JSON.stringify(input) });
	} catch {
		return { error: 'Network error — please try again.' };
	}
	const json = (await res.json().catch(() => null)) as
		| { username: string; animal: string; existed: boolean }
		| { error?: string }
		| null;
	if (!res.ok) return { error: (json as { error?: string })?.error ?? 'Could not register that user.' };
	return json as { username: string; animal: string; existed: boolean };
}

// Preview a generatable identity (username + animal) for the reroll button.
export async function previewIdentity(
	email: string
): Promise<{ username: string; animal: string } | null> {
	const res = await api('/admin/users/preview', { method: 'POST', body: JSON.stringify({ email }) });
	if (!res.ok) return null;
	return (await res.json()) as { username: string; animal: string };
}

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

// Egg order ledger.
export async function fetchOrders(userId: string): Promise<EggOrder[]> {
	const res = await api(`/admin/users/${userId}/orders`);
	if (!res.ok) return [];
	return ((await res.json()) as { orders: EggOrder[] }).orders ?? [];
}
export const recordOrder = (userId: string, input: { eggs: number; orderedAt?: string }) =>
	send(`/admin/users/${userId}/orders`, 'POST', input);
export const deleteOrder = (orderId: string) => send(`/admin/orders/${orderId}`, 'DELETE');

export const createBenefit = (label: string, sortOrder: number) =>
	send('/admin/benefits', 'POST', { label, sortOrder });
export const updateBenefit = (
	id: string,
	patch: { label?: string; sortOrder?: number; active?: boolean }
) => send(`/admin/benefits/${id}`, 'PATCH', patch);
export const deleteBenefit = (id: string) => send(`/admin/benefits/${id}`, 'DELETE');

export const setPlanBenefits = (planId: string, benefitIds: string[]) =>
	send(`/admin/plans/${planId}/benefits`, 'PUT', { benefitIds });

export const createPlan = (input: {
	name: string;
	eggsPerDelivery: number;
	cadenceWeeks?: number;
	priceCents?: number;
	sortOrder?: number;
}) => send('/admin/plans', 'POST', input);

export const updatePlan = (
	planId: string,
	patch: {
		name?: string;
		eggsPerDelivery?: number;
		cadenceWeeks?: number;
		priceCents?: number;
		sortOrder?: number;
		active?: boolean;
	}
) => send(`/admin/plans/${planId}`, 'PATCH', patch);
