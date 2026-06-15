/**
 * Tiny global toast store (Svelte 5 runes). Lives in a `.svelte.ts` module
 * so `$state` is available. Used for the live `achievement_unlocked`
 * notifications pushed over SSE — but generic enough for any transient
 * message.
 */
export type Toast = { id: number; title: string; subtitle?: string };

let items = $state<Toast[]>([]);
let seq = 0;

export const toasts = {
	get items() {
		return items;
	},
	push(toast: Omit<Toast, 'id'>, ttlMs = 6000) {
		const id = ++seq;
		items.push({ id, ...toast });
		if (ttlMs > 0) setTimeout(() => toasts.dismiss(id), ttlMs);
		return id;
	},
	dismiss(id: number) {
		items = items.filter((t) => t.id !== id);
	}
};
