import { invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import { SvelteURLSearchParams } from 'svelte/reactivity';
import type {
	AdminPlansResponse,
	SubscriptionBenefit,
	EggBox
} from '@meteorclass/pigweed-contract';

/**
 * Bits shared across the admin dashboard's panel components
 * (HomePanel / UsersPanel / EggsPanel / TiersPanel / BenefitsPanel).
 * The admin surface is deliberately English-only, so labels here skip i18n.
 */

export type AdminPlan = AdminPlansResponse['plans'][number];
export type AdminBenefit = SubscriptionBenefit & { active: boolean };
/** An egg-box denomination row (already carries `active` from the contract). */
export type AdminBox = EggBox;

/** Build an /admin URL from the current params with overrides (undefined drops a param). */
export function adminUrlWith(overrides: Record<string, string | undefined>): string {
	const sp = new SvelteURLSearchParams(page.url.search);
	for (const [k, v] of Object.entries(overrides)) {
		if (v) sp.set(k, v);
		else sp.delete(k);
	}
	const qs = sp.toString();
	return qs ? `/admin?${qs}` : '/admin';
}

/**
 * Per-panel "busy" gate around admin writes: runs the mutation, refetches the
 * server load after, and swallows re-entrant clicks while in flight.
 */
export function createBusyRunner() {
	let busy = $state(false);
	return {
		get busy() {
			return busy;
		},
		async run(fn: () => Promise<unknown>) {
			if (busy) return;
			busy = true;
			try {
				await fn();
				await invalidateAll();
			} finally {
				busy = false;
			}
		}
	};
}

export const orderDateLabel = (iso: string) =>
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient formatting value, not reactive state
	new Date(iso).toLocaleDateString(undefined, {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

/** The local calendar day an ISO instant falls on, as "YYYY-MM-DD" (DatePicker's format). */
export const localYmd = (iso: string) => {
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient formatting value, not reactive state
	const d = new Date(iso);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const moneyRM = (cents: number) =>
	`RM${(cents / 100).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Rows-per-page choices for the admin tables' client-side pagers. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100].map((n) => ({ value: n, label: String(n) }));

/** True when the instant lands on a LOCAL calendar day after today — flags
 *  future-dated egg orders (usually a date-picker month misclick). */
export const isFutureDay = (iso: string) =>
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient "now", not reactive state
	localYmd(iso) > localYmd(new Date().toISOString());
