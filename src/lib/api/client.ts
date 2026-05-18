import { env } from '$env/dynamic/public';

/**
 * Base URL of the pigweed backend. Driven by PUBLIC_API_BASE_URL so dev
 * (localhost:3000) and the eventual Railway deploy don't need code changes.
 */
export const API_BASE = env.PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

/**
 * fetch wrapper for the backend. Always sends the Better Auth session
 * cookie (`credentials: "include"`) — that's the entire auth mechanism
 * for web, no bearer tokens or localStorage involved.
 */
export async function api(path: string, init: RequestInit = {}): Promise<Response> {
	return fetch(`${API_BASE}${path}`, {
		credentials: 'include',
		...init,
		headers: {
			'Content-Type': 'application/json',
			...init.headers
		}
	});
}
