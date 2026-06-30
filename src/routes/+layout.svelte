<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import LocaleSwitcher from '$lib/components/layout/LocaleSwitcher.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import OrderEggsModal from '$lib/components/home/OrderEggsModal.svelte';
	import SubscriptionModal from '$lib/components/subscription/SubscriptionModal.svelte';
	import UserMenu from '$lib/components/layout/UserMenu.svelte';
	import { LOGO } from '$lib/config/assets';
	import JsonLd from '$lib/components/seo/JsonLd.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { connectEvents, disconnectEvents } from '$lib/realtime/events';
	import type { Session } from '@meteorclass/pigweed-contract';
	import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '$lib/config/seo';

	let { children } = $props();

	// Open the live notifications SSE stream while signed in (client-only —
	// effects don't run during SSR). Key the effect on the user ID (a stable
	// primitive), NOT the session object: every invalidateAll() yields a fresh
	// session object, which would otherwise tear the stream down and back up —
	// and an achievement event arriving in that window (exactly what the
	// post→toast flow triggers) would be missed. Depending on the id means the
	// stream only opens/closes on actual login/logout.
	const userId = $derived((page.data as { session?: Session | null }).session?.user.id ?? null);
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
	<div class="sticky top-0 z-50 flex w-full items-center gap-3 bg-olf-beige px-2 py-3 shadow-sm">
		<a href="/" aria-label="Our Little Farm" class="flex items-center">
			<img src={LOGO} alt="Our Little Farm" class="h-6 w-auto rounded-md" />
		</a>
		<div class="ml-auto flex items-center gap-2">
			<LocaleSwitcher />
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
