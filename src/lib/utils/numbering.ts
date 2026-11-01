/**
 * Running numbers for a hand-ordered list (Farmdex, Projects). Pinned entries
 * keep their number; the rest take the lowest free numbers in list order,
 * skipping every pinned one. Throws on a duplicate pin so it can't ship
 * (dev, check and build all load the data modules).
 */
export function assignNumbers<T>(
	label: string,
	entries: T[],
	pinnedOf: (e: T) => number | undefined
): Map<T, number> {
	const pinned = new Set<number>();
	for (const e of entries) {
		const n = pinnedOf(e);
		if (n == null) continue;
		if (pinned.has(n)) throw new Error(`${label}: number ${formatNumber(n)} is pinned twice`);
		pinned.add(n);
	}
	const numbers = new Map<T, number>();
	let next = 1;
	for (const e of entries) {
		const n = pinnedOf(e);
		if (n != null) {
			numbers.set(e, n);
			continue;
		}
		while (pinned.has(next)) next++;
		numbers.set(e, next++);
	}
	return numbers;
}

/** `#001` style. */
export const formatNumber = (n: number | undefined) => `#${String(n).padStart(3, '0')}`;
