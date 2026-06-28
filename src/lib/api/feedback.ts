import { api } from './client';
import type { FeedbackInput } from '@meteorclass/pigweed-contract';

/**
 * Submit the contact / "egg feedback" form. Rides the cookie `api()` wrapper so
 * the BE can attach the signed-in user (if any) for reply context; works
 * logged-out too. Returns whether it was accepted.
 */
export async function submitFeedback(input: FeedbackInput): Promise<boolean> {
	try {
		const res = await api('/feedback', { method: 'POST', body: JSON.stringify(input) });
		return res.ok;
	} catch {
		return false;
	}
}
