import type { RequestHandler } from './$types';
import { SITE_URL } from '$lib/config/seo';

// Lists only canonical, indexable URLs. Login / signup / settings / demo are
// noindex; public profile pages are discovered via crawl from the home page
// (no public "list users" endpoint to enumerate them here).
export const prerender = false;

export const GET: RequestHandler = () => {
	const now = new Date().toISOString();
	const urls = [{ loc: `${SITE_URL}/`, changefreq: 'daily', priority: '1.0' }];
	const body =
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
		urls
			.map(
				(u) =>
					`  <url><loc>${u.loc}</loc><lastmod>${now}</lastmod>` +
					`<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
			)
			.join('\n') +
		`\n</urlset>\n`;
	return new Response(body, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
};
