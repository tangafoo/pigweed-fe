import { api, API_BASE } from './client';
import type {
	FeedResponse,
	Post,
	PostCategory,
	PostInput,
	Sort
} from '@meteorclass/pigweed-contract';

/**
 * The single data seam for the social feed. Every posts read/write in the
 * FE goes through here, so when the Python embedding/RAG service later
 * becomes the source for the home preview, only this module changes — the
 * components stay put.
 *
 * Everything rides the cookie-based `api()` wrapper (credentials: 'include').
 */

export type FeedParams = {
	lat?: number;
	lng?: number;
	radius?: number;
	sort?: Sort;
	category?: PostCategory;
	/** 1–5; returns posts with rating >= this. */
	minRating?: number;
	/** Filter to a single author — powers the profile "Posts" tab. */
	authorId?: string;
	page?: number;
	limit?: number;
};

function feedQuery(p: FeedParams): string {
	const qs = new URLSearchParams();

	if (p.lat != null && p.lng != null) {
		qs.set('lat', String(p.lat));
		qs.set('lng', String(p.lng));
		if (p.radius != null) qs.set('radius', String(p.radius));
	}

	if (p.sort) qs.set('sort', p.sort);
	if (p.category) qs.set('category', p.category);
	if (p.minRating != null) qs.set('minRating', String(p.minRating));
	if (p.authorId) qs.set('authorId', p.authorId);

	qs.set('page', String(p.page ?? 1));
	qs.set('limit', String(p.limit ?? 20));

	return qs.toString();
}

const EMPTY_FEED = (p: FeedParams): FeedResponse => ({
	posts: [],
	page: p.page ?? 1,
	limit: p.limit ?? 20,
	radiusKm: null,
	sort: p.sort ?? 'newest'
});

/**
 * Fetch the feed. Never throws — returns an empty feed on any failure so
 * the preview/listing degrades gracefully (the feed is public, so this
 * works signed-out too). Pass the SvelteKit `load` `fetch` for SSR; in the
 * browser it's omitted and the cookie-aware `api()` wrapper is used.
 */
export async function fetchFeed(
	params: FeedParams = {},
	fetchImpl?: typeof globalThis.fetch
): Promise<FeedResponse> {
	const path = `/posts?${feedQuery(params)}`;
	try {
		const res = fetchImpl
			? await fetchImpl(`${API_BASE}${path}`, { credentials: 'include' })
			: await api(path);
		if (!res.ok) return EMPTY_FEED(params);
		return (await res.json()) as FeedResponse;
	} catch {
		return EMPTY_FEED(params);
	}
}

/**
 * Fetch a single post by id. Returns `null` on 404 / any failure so the
 * detail route can throw its own SvelteKit `error(404)`. Pass the `load`
 * `fetch` (+ forwarded cookie) for SSR; in the browser the cookie rides along.
 */
export async function fetchPost(
	id: string,
	fetchImpl?: typeof globalThis.fetch,
	cookie?: string
): Promise<Post | null> {
	const path = `/posts/${encodeURIComponent(id)}`;
	try {
		const res = fetchImpl
			? await fetchImpl(`${API_BASE}${path}`, {
					credentials: 'include',
					headers: cookie ? { cookie } : undefined
				})
			: await api(path);
		if (!res.ok) return null;
		const data = (await res.json()) as { post: Post };
		return data.post;
	} catch {
		return null;
	}
}

/** Thrown when moderation blocks a post (422 CONTENT_FLAGGED). */
export class ContentFlaggedError extends Error {
	/** Moderation categories that tripped (e.g. "hate") — NOT post categories. */
	rejectedCategories: string[];
	constructor(message: string, rejectedCategories: string[]) {
		super(message);
		this.name = 'ContentFlaggedError';
		this.rejectedCategories = rejectedCategories;
	}
}

/**
 * Create a post. Throws `ContentFlaggedError` on a moderation block (so the
 * form can show the human reason and let the user edit/retry) and a plain
 * Error on any other failure.
 */
export async function createPost(input: PostInput): Promise<Post> {
	const res = await api('/posts', { method: 'POST', body: JSON.stringify(input) });

	if (res.status === 422) {
		const data = (await res.json().catch(() => null)) as {
			error?: string;
			rejectedCategories?: string[];
		} | null;
		throw new ContentFlaggedError(
			data?.error ?? 'This post was flagged by moderation.',
			data?.rejectedCategories ?? []
		);
	}
	if (!res.ok) {
		const data = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new Error(data?.error ?? `Could not create post (${res.status}).`);
	}

	const data = (await res.json()) as { post: Post };
	return data.post;
}

/** What POST /media returns, ready to drop into a PostInput's `media` array. */
export type UploadedMedia = {
	url: string;
	kind: 'image' | 'video' | 'gif';
	width?: number;
	height?: number;
};

/**
 * Upload one file to the BE media proxy (HEIC→WebP, EXIF-strip, resize,
 * R2). The browser sets the multipart boundary — `api()` deliberately does
 * not force a JSON content-type for FormData bodies.
 *
 * `category` is an optional hint that lets the BE file the object under a
 * readable `media/<username>/<category>/…` key. Omit it for uncategorized.
 */
export async function uploadMedia(file: File, category?: string): Promise<UploadedMedia> {
	const form = new FormData();
	form.append('file', file);
	if (category) form.append('category', category);

	const res = await api('/media', { method: 'POST', body: form });

	if (!res.ok) {
		const data = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new Error(data?.error ?? `Upload failed (${res.status}).`);
	}

	return (await res.json()) as UploadedMedia;
}
