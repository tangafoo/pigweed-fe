import type { AnalyticsCustomer } from '@meteorclass/pigweed-contract';

// Client-side metric helpers for the admin farm dashboard. The BE ships raw
// per-customer rollups + a weekly series; the metric DEFINITIONS (RFM segments,
// at-risk thresholds, deltas) live here so they stay easy to tune without a
// schema/endpoint change.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between two ISO timestamps (a→b), floored, never negative. */
export function daysSince(iso: string, now = Date.now()): number {
	return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY_MS));
}

/** "today" / "1 day ago" / "34 days ago" — for recency lines. */
export function agoLabel(iso: string, now = Date.now()): string {
	const d = daysSince(iso, now);
	if (d <= 0) return 'today';
	if (d === 1) return '1 day ago';
	return `${d} days ago`;
}

/** Fractional change cur vs prev (0.08 = +8%); null when prev is 0 (undefined). */
export function pctDelta(cur: number, prev: number): number | null {
	if (prev === 0) return null;
	return (cur - prev) / prev;
}

/** Compact integer: 1,284 → "1,284", 12_900 → "12.9K". */
export function compactNumber(n: number): string {
	if (Math.abs(n) < 1000) return n.toLocaleString();
	return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(
		n
	);
}

/** "+8%" / "−3%" / "—"; rounds to whole percent. */
export function pctLabel(delta: number | null): string {
	if (delta === null) return '—';
	const pct = Math.round(delta * 100);
	if (pct === 0) return '0%';
	return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
}

// ─── RFM-lite customer segmentation ─────────────────────────────────
// A rule ladder (not quintile scoring) — interpretable on a small farm's
// data and matches the "start with a few clear segments" retail guidance.
// Recency = days since last order; Frequency = order count. First match wins.

export type SegmentKey = 'champion' | 'loyal' | 'active' | 'new' | 'at_risk' | 'lost';
/** Visual tone → drives the badge colors (status-style, always with a label). */
export type SegmentTone = 'good' | 'loyal' | 'new' | 'active' | 'warn' | 'lost';

export interface SegmentMeta {
	key: SegmentKey;
	label: string;
	tone: SegmentTone;
	blurb: string;
}

const SEGMENTS: Record<SegmentKey, Omit<SegmentMeta, 'key'>> = {
	champion: {
		label: 'Champion',
		tone: 'good',
		blurb: 'Frequent and recent — your best customers.'
	},
	loyal: { label: 'Loyal', tone: 'loyal', blurb: 'Repeat buyer, still active.' },
	active: { label: 'Active', tone: 'active', blurb: 'Recently ordered.' },
	new: { label: 'New', tone: 'new', blurb: 'Just started ordering — worth a warm welcome.' },
	at_risk: { label: 'At-risk', tone: 'warn', blurb: 'Was ordering, now gone quiet — nudge them.' },
	lost: { label: 'Lost', tone: 'lost', blurb: 'No order in 3+ months.' }
};

/** Recency thresholds (days). Past AT_RISK → at-risk; past LOST → lost. */
export const AT_RISK_DAYS = 30;
export const LOST_DAYS = 90;

export function segmentOf(c: AnalyticsCustomer, now = Date.now()): SegmentMeta {
	const recency = daysSince(c.lastOrderAt, now);
	const tenure = daysSince(c.firstOrderAt, now);
	let key: SegmentKey;
	if (recency > LOST_DAYS) key = 'lost';
	else if (recency > AT_RISK_DAYS) key = 'at_risk';
	else if (tenure <= 30 && c.orders <= 2) key = 'new';
	else if (c.orders >= 6) key = 'champion';
	else if (c.orders >= 2) key = 'loyal';
	else key = 'active';
	return { key, ...SEGMENTS[key] };
}

/** Customers who've gone quiet (past the at-risk threshold, not yet lost),
 *  most-recently-quiet first — the "nudge these" list. */
export function atRiskCustomers(
	customers: AnalyticsCustomer[],
	now = Date.now()
): AnalyticsCustomer[] {
	return customers
		.filter((c) => {
			const r = daysSince(c.lastOrderAt, now);
			return r > AT_RISK_DAYS && r <= LOST_DAYS;
		})
		.sort((a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime());
}

/** Average days between a customer's orders (cadence); null if <2 orders. */
export function cadenceDays(c: AnalyticsCustomer): number | null {
	if (c.orders < 2) return null;
	const span = new Date(c.lastOrderAt).getTime() - new Date(c.firstOrderAt).getTime();
	return Math.max(1, Math.round(span / DAY_MS / (c.orders - 1)));
}
