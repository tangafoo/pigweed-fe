import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { fetchPost } from '$lib/api/posts';
import { fetchComments } from '$lib/api/comments';

/**
 * Post detail + its comment thread. Both endpoints are public (they render
 * for signed-out visitors), but the BE is a different origin so the request
 * cookie is forwarded explicitly to pick up the viewer's `myVote`. `session`
 * comes from the root layout load — no need to re-resolve it here.
 */
export const load: PageServerLoad = async ({ params, request, fetch }) => {
	const cookie = request.headers.get('cookie') ?? undefined;

	const post = await fetchPost(params.id, fetch, cookie);
	if (!post) throw error(404, 'No such post');

	const comments = await fetchComments(params.id, fetch, cookie);

	return { post, comments };
};
