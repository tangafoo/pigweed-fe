<script lang="ts">
	import type { Post } from '@meteorclass/pigweed-contract';
	import { m } from '$lib/paraglide/messages.js';
	import Avatar from '$lib/components/Avatar.svelte';
	import { Star, ArrowBigUp, ArrowBigDown, MessageSquare } from '@lucide/svelte';
	import { CATEGORY_COLOR } from '$lib/categories';

	interface PostCardProps {
		post: Post;
		/** Fixed-width, shorter card for the home carousel strip. */
		compact?: boolean;
	}
	let { post, compact = false }: PostCardProps = $props();

	const net = $derived(post.upvoteCount - post.downvoteCount);

	// Brand: a card's border grows bushier with its net score (1px–6px).
	const bushiness = $derived(Math.max(1, Math.min(6, 1 + net / 4)));

	const thumb = $derived(post.media.find((m) => m.kind === 'image') ?? post.media[0] ?? null);

	const categoryLabel = (c: NonNullable<Post['category']>) =>
		c === 'EGGS'
			? m.posts_cat_eggs()
			: c === 'VEGGIES'
				? m.posts_cat_veggies()
				: c === 'FRUITS'
					? m.posts_cat_fruits()
					: m.posts_cat_animals();

	const topAwards = $derived(post.awards.slice(0, 3));
</script>

<article
	class="flex flex-col overflow-hidden rounded-xl bg-olf-beige shadow-md {compact
		? 'h-full w-64 shrink-0'
		: 'w-full'} {post.moderated ? '' : 'shiny'}"
	style="border: {bushiness}px solid var(--color-olf-darkgreen)"
>
	<div class="flex flex-1 flex-col gap-2 p-3">
		<!-- Author row -->
		<div class="flex items-center gap-2">
			<a
				href="/users/{post.author.id}"
				class="flex items-center gap-2"
				aria-label={post.author.username}
			>
				<Avatar
					animal={post.author.animal}
					avatarSeed={post.author.avatarSeed}
					gender={post.author.gender}
					size="sm"
				/>
			</a>
			<div class="flex min-w-0 flex-col">
				<span class="flex items-center gap-1.5">
					<a
						href="/users/{post.author.id}"
						class="truncate font-supermercado-one text-sm text-olf-darkbrown"
					>
						{post.author.username}
					</a>
					{#if post.author.isFarmOwner}
						<span
							class="shrink-0 rounded bg-olf-darkgreen px-1.5 font-oswald text-xxs font-bold tracking-wider text-white"
							title={m.posts_op_tooltip()}
						>
							{m.posts_op_badge()}
						</span>
					{/if}
				</span>
				{#if post.rating != null}
					<span
						class="flex items-center gap-0.5"
						aria-label={m.posts_rating_label({ rating: post.rating })}
					>
						{#each [0, 1, 2, 3, 4] as i (i)}
							<Star
								size={12}
								class={i < post.rating
									? 'fill-olf-lightgreen text-olf-darkgreen'
									: 'text-olf-darkbrown/25'}
							/>
						{/each}
					</span>
				{/if}
			</div>
		</div>

		<!-- Title + body -->
		<p class="line-clamp-2 font-oswald font-bold text-olf-darkbrown">{post.title}</p>

		<!-- Category tag (when no thumbnail carried it) -->
		{#if post.category}
			<span
				class="mr-auto rounded-full px-2 py-0.5 font-oswald text-xxs font-bold tracking-widest uppercase {CATEGORY_COLOR[
					post.category
				]}"
			>
				{categoryLabel(post.category)}
			</span>
		{/if}

		{#if post.body}
			{#if !compact}
				<p class="line-clamp-3 font-oswald text-sm text-olf-darkbrown/80">{post.body}</p>
			{:else}
				<p class="line-clamp-3 truncate font-oswald text-sm text-olf-darkbrown/80">
					{post.body}
				</p>
			{/if}
		{/if}

		<!-- Award stack -->
		{#if topAwards.length > 0}
			<div class="mt-auto flex flex-wrap gap-1 pt-1">
				{#each topAwards as a (a.awardTypeId)}
					<span
						class="flex items-center gap-1 rounded-full bg-olf-lightgreen px-2 py-0.5 font-oswald text-xxs font-bold text-olf-darkgreen"
						title={a.name}
					>
						🏅 {a.count}
					</span>
				{/each}
			</div>
		{/if}
	</div>

	{#if thumb}
		<div class="relative {compact ? 'h-28' : 'h-44'} w-full overflow-hidden bg-olf-lightbrown">
			<img src={thumb.url} alt={post.title} class="h-full w-full object-cover" loading="lazy" />
			{#if !post.moderated}
				<span
					class="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 font-oswald text-xxs font-bold tracking-widest text-white uppercase"
				>
					{m.posts_unmoderated()}
				</span>
			{/if}
		</div>
	{/if}
	<div class="flex items-center justify-between bg-olf-darkbrown px-3 py-1.5 text-white">
		<span class="flex shrink-0 items-center gap-1 font-oswald text-xs text-olf-eggshell">
			<MessageSquare size={15} class="text-white" />
			<span class="tabular-nums">{post.commentCount}</span>
		</span>
		<span class="flex shrink-0 items-center gap-0.5 font-oswald text-xs text-olf-eggshell">
			<ArrowBigUp size={16} class="text-white" />
			<span class="tabular-nums">{net}</span>
			<ArrowBigDown size={16} class="text-white" />
		</span>
	</div>
</article>

<style>
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
</style>
