<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '$lib/seo';
	import { m } from '$lib/paraglide/messages.js';

	let { children } = $props();

	// userCount is loaded only by `/`'s `+page.ts`. Layout reads it via
	// the merged page data — undefined on every other route, so the
	// count silently disappears off the home page (no extra fetch cost
	// for /login, /signup, /settings).
	const userCount = $derived(
		(page.data as { userCount?: number | null }).userCount ?? null
	);

	const websiteJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: SITE_NAME,
		url: SITE_URL,
		description: SITE_TAGLINE,
		inLanguage: ['en', 'ko']
	};

	const organizationJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: SITE_NAME,
		url: SITE_URL
	};
</script>

<svelte:head>
	<link rel="icon" href="/favicon.png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</svelte:head>
<JsonLd data={websiteJsonLd} />
<JsonLd data={organizationJsonLd} />

<div class="flex w-full items-center gap-3 bg-olf-darkbrown px-2 py-3">
	<a href="/" class="font-homemade-apple font-bold tracking-wider text-white">Our Little Farm</a>
	<div class="ml-auto flex items-center">
		{#if userCount !== null}
			<span class="font-supermercado-one text-sm text-white">
				{m.home_user_count({ count: userCount })}
			</span>
			<div class="mx-2 h-3.5 border-l border-white/60"></div>
		{/if}
		<LocaleSwitcher />
	</div>
</div>

{@render children()}

<Footer />
