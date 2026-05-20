import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';

// SvelteKit server handle: wraps every request in Paraglide's middleware so
// the resolved locale is set on AsyncLocalStorage for SSR. Inside the resolve
// callback we substitute `%paraglide.lang%` in app.html with the active
// locale — the `<html lang>` attribute then reflects what the user is seeing.
//
// Locale resolution itself happens via the strategy chain configured in
// vite.config.ts (cookie → preferredLanguage → globalVariable → baseLocale).
// We don't touch it here; we just let the middleware do its job and pipe
// the result into the HTML.

export const handle: Handle = ({ event, resolve }) => {
	return paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});
};
