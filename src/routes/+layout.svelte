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

	// Admin-only navbar chicken: one greets right away on entering the admin,
	// then a random one of the four hand-drawn chickens pops up inside the
	// header (clipped by it) every 5 minutes — looks left, looks right, ducks
	// back down. One cycle per pop — the element unmounts on animationend and
	// the interval re-arms it.
	const PEEK_CHICKENS = [
		'henkerchief.webp',
		'hen with chicks.webp',
		'chicken-drawing-white.webp',
		'chicken-drawing-brown.webp'
	];
	const PEEK_EVERY_MS = 5 * 60_000;
	let peekChicken = $state('');
	let peeking = $state(false);
	const isAdminRoute = $derived(page.url.pathname.startsWith('/admin'));
	$effect(() => {
		if (!isAdminRoute) return;
		const pop = () => {
			peekChicken = PEEK_CHICKENS[Math.floor(Math.random() * PEEK_CHICKENS.length)];
			peeking = true;
		};
		pop(); // greet on entry
		const timer = setInterval(pop, PEEK_EVERY_MS);
		return () => {
			clearInterval(timer);
			peeking = false;
		};
	});

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
		{#if isAdminRoute && peeking}
			<!-- Clip box spanning the whole navbar — the chicken rises into it and
			     everything below the bar's bottom edge stays hidden. -->
			<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
				<img
					src={asset(peekChicken)}
					alt=""
					draggable="false"
					onanimationend={() => (peeking = false)}
					class="admin-peek-chicken absolute bottom-0 left-1/2 h-24 w-auto select-none"
				/>
			</div>
		{/if}
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

<style>
	/* Admin navbar chicken: rise from below the bar, tilt left, tilt right,
	   duck back down. translateX(-50%) centers (left-1/2 anchor) and must ride
	   every frame since keyframes replace the whole transform. */
	.admin-peek-chicken {
		transform: translate(-50%, 100%);
		transform-origin: 50% 90%;
		/* One cycle per pop; `both` holds the hidden end state until unmount. */
		animation: admin-peek 4.5s ease-in-out 1 both;
	}
	/* Rise → hold facing one way → quick scaleX flip (reads as turning to look
	   the other way) → hold → flip back → duck down. */
	@keyframes admin-peek {
		0% {
			transform: translate(-50%, 100%) scaleX(1);
		}
		12% {
			transform: translate(-50%, 35%) scaleX(1);
		}
		38% {
			transform: translate(-50%, 35%) scaleX(1);
		}
		46% {
			transform: translate(-50%, 35%) scaleX(-1);
		}
		76% {
			transform: translate(-50%, 35%) scaleX(-1);
		}
		84% {
			transform: translate(-50%, 35%) scaleX(1);
		}
		100% {
			transform: translate(-50%, 100%) scaleX(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.admin-peek-chicken {
			animation: none;
		}
	}
</style>
