import { invalidateAll } from '$app/navigation';
import { API_BASE } from '$lib/api/client';
import type { AchievementUnlockedEvent } from '@meteorclass/pigweed-contract';
import { toasts } from './toasts.svelte';

/**
 * The live notifications channel. Open ONCE after sign-in (the layout wires
 * this to the session). The BE pushes `achievement_unlocked` over SSE when a
 * post/comment/award crosses an achievement threshold — we surface a toast
 * and re-run the layout load so the coin balance shown in the UI reflects
 * the freshly-credited reward. `connected`/`ping` frames are ignored.
 *
 * Never poll (per the BE brief) — this stream is the only mechanism.
 */
let es: EventSource | null = null;

export function connectEvents(): void {
	if (es) return; // idempotent — one stream per tab
	es = new EventSource(`${API_BASE}/users/me/events`, { withCredentials: true });

	es.addEventListener('connected', () => console.log('[sse] connected'));
	es.addEventListener('error', () => console.warn('[sse] connection error (will retry)'));

	es.addEventListener('achievement_unlocked', (e) => {
		try {
			const data = JSON.parse((e as MessageEvent).data) as AchievementUnlockedEvent;
			console.log(
				`[sse] achievement_unlocked: ${data.achievement.name} (+${data.achievement.rewardCoins})`
			);
			toasts.push({
				title: `🏆 ${data.achievement.name}`,
				subtitle: `+${data.achievement.rewardCoins} coins`
			});
			// Authoritative coin refresh — pulls the new balance into every
			// surface bound to session data (home account bar, profile, …).
			invalidateAll();
		} catch {
			// Malformed frame — ignore rather than break the stream.
		}
	});
}

export function disconnectEvents(): void {
	es?.close();
	es = null;
}
