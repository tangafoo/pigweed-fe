<script lang="ts">
	import type { Post } from '@meteorclass/pigweed-contract';
	import { m } from '$lib/paraglide/messages.js';
	import { ArrowRight } from '@lucide/svelte';

	interface LatestPostsStripProps {
		posts: Post[];
	}

	let { posts }: LatestPostsStripProps = $props();

	// Padded to a comfortable card count (in case the feed is near-empty),
	// then doubled so the marquee loops with no visible seam — translating
	// -50% always lands on an identical half.
	const filled = $derived(
		posts.length > 0
			? Array.from({ length: Math.ceil(8 / posts.length) }, () => posts).flat()
			: []
	);
	const track = $derived([...filled, ...filled]);

	const net = (post: Post) => post.upvoteCount - post.downvoteCount;
	// Brand: a card's border grows bushier with its net score (1px–6px).
	const bushiness = (post: Post) => Math.max(1, Math.min(6, 1 + net(post) / 4));
</script>

<section class="bg-olf-lightgreen px-6 py-8">
	<p class="text-center font-oswald text-xs tracking-[0.25em] text-olf-darkgreen uppercase">
		{m.home_latest_kicker()}
	</p>

	{#if posts.length > 0}
		<div class="marquee -mx-6 mt-5 overflow-hidden">
			<div class="marquee-track flex w-max">
				{#each track as post, i (post.id + '-' + i)}
					<article
						class="mr-3 flex h-28 w-52 shrink-0 flex-col bg-olf-beige p-3 {post.moderated
							? ''
							: 'shiny'}"
						style="border: {bushiness(post)}px solid var(--color-olf-darkgreen)"
					>
						<p class="line-clamp-2 font-oswald font-bold text-olf-darkbrown">
							{post.title}
						</p>
						<div
							class="mt-auto flex items-center justify-between font-oswald text-xs text-olf-darkbrown/70"
						>
							<span class="truncate font-supermercado-one">{post.author.username}</span>
							<span class="shrink-0">▲ {net(post)}</span>
						</div>
					</article>
				{/each}
			</div>
		</div>
	{:else}
		<p class="mt-3 text-center font-oswald text-sm text-olf-darkgreen/80">
			{m.home_latest_empty()}
		</p>
	{/if}

	<div class="mt-6 flex justify-center">
		<a
			href="/posts"
			class="flex items-center gap-2 rounded-full bg-olf-darkbrown px-5 py-2 font-oswald text-sm font-bold tracking-widest text-olf-beige uppercase"
		>
			{m.home_enter_farm()}
			<ArrowRight size={16} class="shrink-0" />
		</a>
	</div>
</section>

<style>
	.marquee-track {
		animation: marquee 32s linear infinite;
	}
	.marquee:hover .marquee-track {
		animation-play-state: paused;
	}
	@keyframes marquee {
		from {
			transform: translateX(-50%);
		}
		to {
			transform: translateX(0);
		}
	}
	/* UNMODERATED posts get a foil shimmer — rare collectibles, per the brand. */
	.shiny {
		background-image: linear-gradient(
			115deg,
			#f3e4c9 0%,
			#fff6e0 25%,
			#cfe08f 50%,
			#fff6e0 75%,
			#f3e4c9 100%
		);
	}
	@media (prefers-reduced-motion: reduce) {
		.marquee {
			overflow-x: auto;
		}
		.marquee-track {
			animation: none;
		}
	}
</style>
