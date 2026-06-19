<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import OrderEggsModal from '$lib/components/OrderEggsModal.svelte';
	import { UserRound } from '@lucide/svelte';
	import { m } from '$lib/paraglide/messages.js';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { connectEvents, disconnectEvents } from '$lib/realtime/events';
	import type { Session } from '@meteorclass/pigweed-contract';
	import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '$lib/seo';

	let { children } = $props();

	// Open the live notifications SSE stream while signed in (client-only —
	// effects don't run during SSR). Key the effect on the user ID (a stable
	// primitive), NOT the session object: every invalidateAll() yields a fresh
	// session object, which would otherwise tear the stream down and back up —
	// and an achievement event arriving in that window (exactly what the
	// post→toast flow triggers) would be missed. Depending on the id means the
	// stream only opens/closes on actual login/logout.
	const userId = $derived(
		(page.data as { session?: Session | null }).session?.user.id ?? null
	);
	$effect(() => {
		if (!userId) return;
		connectEvents();
		return () => disconnectEvents();
	});

	const websiteJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: SITE_NAME,
		url: SITE_URL,
		description: SITE_TAGLINE,
		inLanguage: ['en', 'ko', 'zh', 'ja']
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

<div class="flex min-h-dvh flex-col">
	<div class="flex w-full items-center gap-3 bg-olf-darkbrown px-2 py-3">
		<a href="/" class="font-homemade-apple font-bold tracking-wider text-white">Our Little Farm</a>
		<div class="ml-auto flex items-center gap-2">
			<LocaleSwitcher />
			{#if userId}
				<a
					href="/users/{userId}"
					aria-label={m.home_profile_link()}
					class="flex size-8 items-center justify-center rounded-full bg-olf-beige/15 text-white hover:bg-olf-beige/25"
				>
					<UserRound size={18} />
				</a>
			{/if}
		</div>
	</div>

	<main class="flex flex-1 flex-col">
		{@render children()}
	</main>

	<Footer />
</div>
<OrderEggsModal />
<Toast />
