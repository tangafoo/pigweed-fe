import { api } from './client';
import type { VoteResponse, VoteValue } from '@meteorclass/pigweed-contract';

/**
 * Vote data seam. Cookie-auth'd PUT/DELETE against the BE vote endpoints,
 * which echo the authoritative `{ upvoteCount, downvoteCount, myVote }` so a
 * caller can reconcile its optimistic update against the server's truth.
 *
 * Both return `null` on any failure (network error, or a non-2xx such as the
 * 401 a signed-out viewer gets) — the caller treats that as "roll back".
 */

/** PUT a vote. Idempotent server-side; re-sending the same value is a no-op. */
export async function setPostVote(postId: string, value: VoteValue): Promise<VoteResponse | null> {
	try {
		const res = await api(`/posts/${encodeURIComponent(postId)}/vote`, {
			method: 'PUT',
			body: JSON.stringify({ value })
		});
		if (!res.ok) return null;
		return (await res.json()) as VoteResponse;
	} catch {
		return null;
	}
}

/** DELETE a vote (un-vote / toggle off). */
export async function clearPostVote(postId: string): Promise<VoteResponse | null> {
	try {
		const res = await api(`/posts/${encodeURIComponent(postId)}/vote`, { method: 'DELETE' });
		if (!res.ok) return null;
		return (await res.json()) as VoteResponse;
	} catch {
		return null;
	}
}

/** PUT a comment vote. Same idempotent semantics as the post endpoint. */
export async function setCommentVote(
	commentId: string,
	value: VoteValue
): Promise<VoteResponse | null> {
	try {
		const res = await api(`/comments/${encodeURIComponent(commentId)}/vote`, {
			method: 'PUT',
			body: JSON.stringify({ value })
		});
		if (!res.ok) return null;
		return (await res.json()) as VoteResponse;
	} catch {
		return null;
	}
}

/** DELETE a comment vote (un-vote / toggle off). */
export async function clearCommentVote(commentId: string): Promise<VoteResponse | null> {
	try {
		const res = await api(`/comments/${encodeURIComponent(commentId)}/vote`, { method: 'DELETE' });
		if (!res.ok) return null;
		return (await res.json()) as VoteResponse;
	} catch {
		return null;
	}
}
