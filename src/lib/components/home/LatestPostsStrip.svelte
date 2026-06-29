<script lang="ts">
	import type { Post, Session } from '@meteorclass/pigweed-contract';
	import { m } from '$lib/paraglide/messages.js';
	import PostCard from '$lib/components/posts/PostCard.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import { asset } from '$lib/config/assets';
	import { ArrowRight, Plus } from '@lucide/svelte';

	interface LatestPostsStripProps {
		posts: Post[];
		/** Total posts across the feed — drives the "See All (x)" count. */
		totalCount: number;
		session: Session | null;
	}
	let { posts, totalCount, session }: LatestPostsStripProps = $props();

	// Padded to a comfortable card count so a near-empty feed still fills the strip.
	const cards = $derived(
		posts.length > 0 ? Array.from({ length: Math.ceil(8 / posts.length) }, () => posts).flat() : []
	);

	// Gentle auto-advance over NATIVE horizontal scroll — no GSAP, no transforms.
	// The browser owns the scroll position, so a manual swipe/drag/wheel never
	// fights an animation (the old hand-rolled GSAP loop drove scrollLeft itself,
	// which is what felt "clashy"). A timer nudges one card forward every few
	// seconds with a smooth scrollBy; any real user gesture pauses it, and it
	// resumes after a short idle. Reduced-motion → no auto-advance at all.
	function autoScroll(node: HTMLElement) {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		const STEP_MS = 3000; // how long each card holds before advancing
		const RESUME_MS = 4000; // idle after you interact before it resumes
		let timer: ReturnType<typeof setInterval> | undefined;
		let idle: ReturnType<typeof setTimeout> | undefined;

		// One card's worth of scroll (fixed-width card + the flex gap).
		const cardStep = () => {
			const card = node.querySelector('article');
			const gap = parseFloat(getComputedStyle(node).columnGap) || 0;
			return card ? card.getBoundingClientRect().width + gap : node.clientWidth;
		};
		const tick = () => {
			const end = node.scrollWidth - node.clientWidth;
			// At the end, loop back to the start; otherwise step one card on.
			if (node.scrollLeft >= end - 4) node.scrollTo({ left: 0, behavior: 'smooth' });
			else node.scrollBy({ left: cardStep(), behavior: 'smooth' });
		};

		const stop = () => {
			clearInterval(timer);
			timer = undefined;
		};
		const play = () => {
			stop();
			timer = setInterval(tick, STEP_MS);
		};
		// Pause on a real user gesture, then resume after a beat. These events are
		// only ever fired by the user — a programmatic scrollBy never triggers
		// them, so the loop can't accidentally pause itself.
		const interrupt = () => {
			stop();
			clearTimeout(idle);
			idle = setTimeout(play, RESUME_MS);
		};

		node.addEventListener('pointerenter', stop);
		node.addEventListener('pointerleave', play);
		node.addEventListener('pointerdown', interrupt);
		node.addEventListener('wheel', interrupt, { passive: true });
		node.addEventListener('touchstart', interrupt, { passive: true });

		play();

		return {
			destroy() {
				stop();
				clearTimeout(idle);
				node.removeEventListener('pointerenter', stop);
				node.removeEventListener('pointerleave', play);
				node.removeEventListener('pointerdown', interrupt);
				node.removeEventListener('wheel', interrupt);
				node.removeEventListener('touchstart', interrupt);
			}
		};
	}
</script>

<section class="bg-olf-lightgreen pt-4 pb-8">
	<div class="flex w-full items-center justify-between px-4 pb-8 lg:px-6">
		{#if session}
			<div class="flex w-full justify-between lg:gap-4">
				<div class="flex items-center gap-2">
					<a href="/users/{session.user.id}" aria-label={m.home_profile_link()}>
						<Avatar
							animal={session.user.animal}
							avatarSeed={session.user.avatarSeed}
							gender={session.user.gender}
							size="sm"
						/>
					</a>
					<p class="font-semibold">{session.user.username}</p>
				</div>
				<div class="flex items-center gap-2">
					<div class="flex items-center gap-1.5 rounded-full bg-olf-beige px-3 text-sm shadow-md">
						<img src={asset('egg05.webp')} alt="" class="h-4 w-4 shrink-0 object-contain" />
						<p>{session.user.coinBalance}</p>
					</div>
					<a
						href="/posts/new"
						aria-label={m.home_post_review()}
						class="flex size-7 shrink-0 items-center justify-center rounded-full bg-olf-darkgreen text-olf-beige shadow-md"
					>
						<Plus size={18} />
					</a>
				</div>
			</div>
		{:else}
			<div class="ml-auto flex items-center gap-2 lg:ml-0">
				<a href="/login" class="rounded-full bg-olf-beige px-3 py-1 text-sm font-bold shadow-md">
					{m.home_signin_link()} 🐓
				</a>
				<a
					href="/signup"
					class="flex items-center gap-1.5 rounded-full bg-olf-darkbrown px-3 py-1 text-sm font-bold text-olf-beige shadow-md"
				>
					{m.home_post_review()}
				</a>
			</div>
		{/if}
	</div>

	{#if posts.length > 0}
		<!-- px is half-the-viewport minus half a card (cards are w-64 = 16rem),
		     so the first/last post can sit dead-centre. -->
		<div
			use:autoScroll
			class="carousel flex gap-3 overflow-x-auto px-[max(0px,calc(50%-8rem))] pb-2"
		>
			{#each cards as post, i (post.id + '-' + i)}
				<PostCard {post} compact />
			{/each}
		</div>
	{:else}
		<p class="mt-3 text-center font-oswald text-sm text-olf-darkgreen/80">
			{m.home_latest_empty()}
		</p>
	{/if}

	<div class="mt-6 flex justify-center">
		<a
			href="/posts"
			class="flex items-center gap-2 rounded-full bg-olf-darkgreen px-5 py-1.5 font-oswald text-sm font-bold tracking-widest text-olf-eggshell uppercase shadow-lg"
		>
			{m.home_enter_farm({ count: totalCount })}
			<ArrowRight size={16} class="shrink-0" />
		</a>
	</div>
</section>

<style>
	/* Native horizontal scroller; just hide the scrollbar. The browser handles
	   touch/trackpad scrolling, and the auto-advance uses native smooth scroll. */
	.carousel {
		scrollbar-width: none; /* Firefox */
	}
	.carousel::-webkit-scrollbar {
		display: none;
	}
</style>
