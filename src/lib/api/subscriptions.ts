import { api, API_BASE } from './client';
import type {
	SubscriptionPlanWithBenefits,
	MySubscriptionResponse
} from '@meteorclass/pigweed-contract';

/**
 * The data seam for egg subscriptions. Tiers + benefits are public; the
 * viewer's own subscription needs the session cookie. Both ride the
 * cookie-based `api()` wrapper in the browser, or take the SvelteKit `load`
 * `fetch` (+ forwarded cookie) for SSR.
 *
 * Payments are MANUAL today — the FE only reads. Subscribing is a WhatsApp
 * link (TierCard); the admin flips the subscription on from the panel.
 */

/** Tiers (with each tier's benefit checklist) for the subscribe page/modal. Never throws. */
export async function fetchPlans(
	fetchImpl?: typeof globalThis.fetch
): Promise<SubscriptionPlanWithBenefits[]> {
	const path = '/subscriptions/plans';
	try {
		const res = fetchImpl
			? await fetchImpl(`${API_BASE}${path}`, { credentials: 'include' })
			: await api(path);
		if (!res.ok) return [];
		const data = (await res.json()) as { plans: SubscriptionPlanWithBenefits[] };
		return data.plans ?? [];
	} catch {
		return [];
	}
}

const EMPTY_MINE: MySubscriptionResponse = { subscription: null, stats: null };

/** The signed-in viewer's subscription + egg stats. Returns nulls signed-out / on failure. */
export async function fetchMySubscription(
	fetchImpl?: typeof globalThis.fetch,
	cookie?: string
): Promise<MySubscriptionResponse> {
	const path = '/subscriptions/me';
	try {
		const res = fetchImpl
			? await fetchImpl(`${API_BASE}${path}`, {
					credentials: 'include',
					headers: cookie ? { cookie } : undefined
				})
			: await api(path);
		if (!res.ok) return EMPTY_MINE;
		return (await res.json()) as MySubscriptionResponse;
	} catch {
		return EMPTY_MINE;
	}
}
