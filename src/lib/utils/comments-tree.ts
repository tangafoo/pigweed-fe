import type { Comment } from '@meteorclass/pigweed-contract';

/** A comment plus its assembled reply subtree. */
export type CommentNode = Comment & { children: CommentNode[] };

/**
 * Assemble the BE's flat comment list (each row carries `parentCommentId` +
 * `depth`) into a nested tree, preserving the server's oldest-first order.
 * Soft-deleted comments stay in place (redacted) so a branch is never lost
 * when its parent was deleted. A reply whose parent isn't present is hoisted
 * to a root rather than dropped.
 */
export function buildCommentTree(flat: Comment[]): CommentNode[] {
	const byId = new Map<string, CommentNode>();
	for (const c of flat) byId.set(c.id, { ...c, children: [] });

	const roots: CommentNode[] = [];
	for (const c of flat) {
		const node = byId.get(c.id)!;
		const parent = c.parentCommentId ? byId.get(c.parentCommentId) : null;
		if (parent) parent.children.push(node);
		else roots.push(node);
	}
	return roots;
}
