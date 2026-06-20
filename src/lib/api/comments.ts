import { api, API_BASE } from './client';
import { ContentFlaggedError } from './posts';
import type { Comment } from '@meteorclass/pigweed-contract';

/**
 * Comment data seam. The thread is fetched flat (every comment carries
 * `parentCommentId` + `depth`); the tree is assembled client-side. Soft-
 * deleted comments are returned redacted (`body: "[deleted]"`, `author: null`)
 * so the tree stays intact — never filter them out here.
 */

/**
 * Fetch a post's comments (flat, oldest-first). Returns `[]` on any failure so
 * the detail page degrades to "no comments" rather than erroring. Pass the
 * `load` `fetch` (+ forwarded cookie) for SSR.
 */
export async function fetchComments(
	postId: string,
	fetchImpl?: typeof globalThis.fetch,
	cookie?: string
): Promise<Comment[]> {
	const path = `/posts/${encodeURIComponent(postId)}/comments`;
	try {
		const res = fetchImpl
			? await fetchImpl(`${API_BASE}${path}`, {
					credentials: 'include',
					headers: cookie ? { cookie } : undefined
				})
			: await api(path);
		if (!res.ok) return [];
		const data = (await res.json()) as { comments: Comment[] };
		return data.comments;
	} catch {
		return [];
	}
}

/**
 * Post a comment (or a reply, when `parentCommentId` is given). Throws
 * `ContentFlaggedError` on a moderation block (422) so the composer can show
 * the human reason, and a plain Error on any other failure.
 */
export async function createComment(
	postId: string,
	body: string,
	parentCommentId?: string
): Promise<Comment> {
	const res = await api(`/posts/${encodeURIComponent(postId)}/comments`, {
		method: 'POST',
		body: JSON.stringify(parentCommentId ? { body, parentCommentId } : { body })
	});

	if (res.status === 422) {
		const data = (await res.json().catch(() => null)) as {
			error?: string;
			rejectedCategories?: string[];
		} | null;
		throw new ContentFlaggedError(
			data?.error ?? 'This comment was flagged by moderation.',
			data?.rejectedCategories ?? []
		);
	}
	if (!res.ok) {
		const data = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new Error(data?.error ?? `Could not post comment (${res.status}).`);
	}

	const data = (await res.json()) as { comment: Comment };
	return data.comment;
}
