import { env } from '$env/dynamic/public';
import type { PageLoad } from './$types';
import type { FeedResponse, Post } from '@meteorclass/pigweed-contract';

const MANTIN_LAT = 2.7;
const MANTIN_LNG = 101.93;
const API_BASE = env.PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

async function fetchWeather(fetch: typeof globalThis.fetch) {
	try {
		const url = `https://api.open-meteo.com/v1/forecast?latitude=${MANTIN_LAT}&longitude=${MANTIN_LNG}&current=temperature_2m,relative_humidity_2m`;
		const res = await fetch(url);
		if (!res.ok) return null;
		const json = (await res.json()) as {
			current: { temperature_2m: number; relative_humidity_2m: number };
		};
		return {
			temperature: Math.round(json.current.temperature_2m),
			humidity: Math.round(json.current.relative_humidity_2m)
		};
	} catch {
		return null;
	}
}

async function fetchUserCount(fetch: typeof globalThis.fetch): Promise<number | null> {
	try {
		const res = await fetch(`${API_BASE}/users/count`);
		if (!res.ok) return null;
		const json = (await res.json()) as { count: number };
		return json.count;
	} catch {
		return null;
	}
}

async function fetchLatestPosts(fetch: typeof globalThis.fetch): Promise<Post[]> {
	try {
		const res = await fetch(`${API_BASE}/posts?sort=newest&page=1&limit=10`);
		if (!res.ok) return [];
		const json = (await res.json()) as FeedResponse;
		return json.posts ?? [];
	} catch {
		return [];
	}
}

export const load: PageLoad = async ({ fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=600' });
	const [weather, userCount, latestPosts] = await Promise.all([
		fetchWeather(fetch),
		fetchUserCount(fetch),
		fetchLatestPosts(fetch)
	]);
	return { weather, userCount, latestPosts };
};
