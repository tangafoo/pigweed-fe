<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import LocaleSwitcher from '$lib/components/layout/LocaleSwitcher.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import OrderEggsModal from '$lib/components/home/OrderEggsModal.svelte';
	import SubscriptionModal from '$lib/components/subscription/SubscriptionModal.svelte';
	import UserMenu from '$lib/components/layout/UserMenu.svelte';
	import { asset, LOGO } from '$lib/config/assets';
	import JsonLd from '$lib/components/seo/JsonLd.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import LoadingOverlay from '$lib/components/ui/LoadingOverlay.svelte';
	import { connectEvents, disconnectEvents } from '$lib/realtime/events';
	import type { Session } from '@meteorclass/pigweed-contract';
	import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '$lib/config/seo';

	let { children } = $props();

	// Measured navbar height, published as --navbar-h so descendants (e.g. the
	// admin sidebar) can size themselves to exactly 100dvh minus the sticky
	// header — no hardcoded pixel guesses.
	let navbarHeight = $state(0);

	// Open the live notifications SSE stream while signed in (client-only —
	// effects don't run during SSR). Key the effect on the user ID (a stable
	// primitive), NOT the session object: every invalidateAll() yields a fresh
	// session object, which would otherwise tear the stream down and back up —
	// and an achievement event arriving in that window (exactly what the
	// post→toast flow triggers) would be missed. Depending on the id means the
	// stream only opens/closes on actual login/logout.
	const sessionUser = $derived((page.data as { session?: Session | null }).session?.user ?? null);
	const userId = $derived(sessionUser?.id ?? null);
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

<div class="flex min-h-dvh flex-col" style="--navbar-h: {navbarHeight}px">
	<div
		bind:clientHeight={navbarHeight}
		class="sticky top-0 z-50 flex w-full items-center gap-3 bg-olf-beige px-2 py-2.5 shadow-sm lg:py-3"
	>
		<a href="/" aria-label="Our Little Farm" class="flex items-center">
			<img src={LOGO} alt="Our Little Farm" class="h-5.5 w-auto rounded-md lg:h-7" />
		</a>
		<div class="ml-auto flex items-center gap-2">
			<LocaleSwitcher />
			{#if sessionUser}
				<!-- Coin balance pill — same treatment as the one in LatestPostsStrip.
				     invalidateAll() on SSE achievement events keeps it live (the
				     session refetch carries the new balance). -->
				<div
					title="Egg coins"
					class="flex items-center gap-1.5 rounded-full bg-olf-eggshell px-3 text-sm shadow-md"
				>
					<img src={asset('egg05.webp')} alt="" class="h-4 w-4 shrink-0 object-contain" />
					<p>{sessionUser.coinBalance}</p>
				</div>
			{/if}
			<UserMenu {userId} />
		</div>
	</div>

	<main class="flex flex-1 flex-col">
		{@render children()}
	</main>

	<Footer />
</div>
<OrderEggsModal />
<SubscriptionModal />
<Toast />
<LoadingOverlay />
