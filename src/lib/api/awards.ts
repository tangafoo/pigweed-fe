import { api } from './client';
import type { Animal, AwardType, Gender } from '@meteorclass/pigweed-contract';

/**
 * Awards data seam — the gift picker catalog + granting. Mirrors the BE's
 * `src/routes/awards.ts`. Granting spends the signed-in user's coins
 * atomically server-side; an insufficient balance comes back as a 400 with
 * "insufficient coin balance", surfaced here as a typed result so the modal
 * can render the right message without string-matching in the component.
 */

// The catalog is tiny and immutable within a session — fetch once, share
// across every card's modal.
let typesCache: Promise<AwardType[]> | null = null;

export function fetchAwardTypes(): Promise<AwardType[]> {
	typesCache ??= (async () => {
		try {
			const res = await api('/awards/types');
			if (!res.ok) return [];
			const data = (await res.json()) as { types: AwardType[] };
			return data.types;
		} catch {
			return [];
		}
	})().then((types) => {
		// Don't cache a failed/empty fetch — let the next open retry.
		if (types.length === 0) typesCache = null;
		return types;
	});
	return typesCache;
}

export type GrantResult =
	| { ok: true }
	| { ok: false; code: 'insufficient' | 'error'; message: string };

export type AwardTarget = 'post' | 'comment';

/** Gift an award (`POST /posts/:id/awards` or `POST /comments/:id/awards`). */
export async function grantAward(
	target: AwardTarget,
	targetId: string,
	awardTypeId: string
): Promise<GrantResult> {
	try {
		const res = await api(`/${target}s/${encodeURIComponent(targetId)}/awards`, {
			method: 'POST',
			body: JSON.stringify({ awardTypeId })
		});
		if (res.ok) return { ok: true };
		const data = (await res.json().catch(() => null)) as { error?: string } | null;
		const message = data?.error ?? `Could not gift (${res.status}).`;
		return {
			ok: false,
			code: message.includes('insufficient') ? 'insufficient' : 'error',
			message
		};
	} catch {
		return { ok: false, code: 'error', message: 'network' };
	}
}

/** One attributed grant from the granters list (who gifted what, newest first). */
export type Granter = {
	id: string;
	createdAt: string;
	granter: { id: string; username: string; gender: Gender; animal: Animal; avatarSeed: number };
	awardType: { id: string; assetKey: string; name: string };
};

export type GrantersResult =
	| { status: 'ok'; granters: Granter[] }
	/** Pay-gated: the viewer isn't the author and hasn't unlocked this target. */
	| { status: 'locked'; unlockCoins: number }
	| { status: 'error' };

/** Who gifted awards to a post/comment. Author sees it free; others 402 until unlocked. */
export async function fetchGranters(
	target: AwardTarget,
	targetId: string
): Promise<GrantersResult> {
	try {
		const res = await api(`/${target}s/${encodeURIComponent(targetId)}/awards/granters`);
		if (res.ok) {
			const data = (await res.json()) as { granters: Granter[] };
			return { status: 'ok', granters: data.granters };
		}
		if (res.status === 402) {
			const data = (await res.json().catch(() => null)) as { unlockCoins?: number } | null;
			return { status: 'locked', unlockCoins: data?.unlockCoins ?? 0 };
		}
		return { status: 'error' };
	} catch {
		return { status: 'error' };
	}
}

/**
 * Who gifted a specific award type to a user, aggregated across all their posts
 * + comments. Self-only + free on the BE (the profile awards section is
 * owner-only), so no unlock gate — just returns the list (newest first).
 */
export async function fetchUserAwardGranters(
	userId: string,
	awardTypeId: string
): Promise<Granter[]> {
	try {
		const res = await api(
			`/users/${encodeURIComponent(userId)}/awards/granters?awardTypeId=${encodeURIComponent(awardTypeId)}`
		);
		if (!res.ok) return [];
		return ((await res.json()) as { granters: Granter[] }).granters ?? [];
	} catch {
		return [];
	}
}

export type UnlockResult = { ok: true } | { ok: false; code: 'nocoins' | 'error' };

/** Spend 1 unlockCoin to permanently unlock a target's granters list. */
export async function unlockGranters(target: AwardTarget, targetId: string): Promise<UnlockResult> {
	try {
		const res = await api(`/${target}s/${encodeURIComponent(targetId)}/awards/granters/unlock`, {
			method: 'POST'
		});
		if (res.ok) return { ok: true };
		return { ok: false, code: res.status === 402 ? 'nocoins' : 'error' };
	} catch {
		return { ok: false, code: 'error' };
	}
}
