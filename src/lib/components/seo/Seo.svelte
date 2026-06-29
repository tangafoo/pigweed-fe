<script lang="ts">
	import { page } from '$app/state';
	import { SITE_NAME, SITE_OG_IMAGE, SITE_TAGLINE, absoluteUrl } from '$lib/config/seo';

	type SeoProps = {
		title: string;
		description?: string;
		// og:description, when it should differ from the meta/twitter description.
		// Defaults to `description` so callers that pass one value stay in sync.
		ogDescription?: string;
		image?: string;
		path?: string;
		type?: 'website' | 'article' | 'profile';
		noindex?: boolean;
	};

	let {
		title,
		description = SITE_TAGLINE,
		ogDescription = description,
		image = SITE_OG_IMAGE,
		path,
		type = 'website',
		noindex = false
	}: SeoProps = $props();

	const canonical = $derived(absoluteUrl(path ?? page.url.pathname));
	const ogImage = $derived(absoluteUrl(image));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	{#if noindex}
		<meta name="robots" content="noindex, follow" />
	{/if}

	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:type" content={type} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={ogDescription} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:alt" content={SITE_NAME} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>
