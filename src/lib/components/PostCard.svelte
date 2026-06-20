<script lang="ts">
	import type { Post } from '@meteorclass/pigweed-contract';
	import { m } from '$lib/paraglide/messages.js';
	import Avatar from '$lib/components/Avatar.svelte';
	import {
		Star,
		ArrowBigUp,
		ArrowBigDown,
		MessageSquare,
		Maximize2,
		Minimize2
	} from '@lucide/svelte';
	import { CATEGORY_COLOR, CATEGORY_EMOJI } from '$lib/categories';
	import { formatRelative } from '$lib/utils/date';

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

	// Tap the expand button to let the image grow from the cropped thumbnail to
	// its full natural height, animated as a height slide. We animate an explicit
	// px height (CSS can't transition to `auto`): full height = the box's current
	// width × the image's aspect ratio, measured on load so it stays responsive.
	let expanded = $state(false);
	let boxW = $state(0);
	let aspect = $state<number | null>(null);
	const collapsedH = $derived(compact ? 144 : 176); // h-36 / h-44 in px
	const fullH = $derived(aspect && boxW ? Math.round(boxW * aspect) : collapsedH);
	const boxH = $derived(expanded ? fullH : collapsedH);
	function onImgLoad(e: Event) {
		const img = e.currentTarget as HTMLImageElement;
		if (img.naturalWidth) aspect = img.naturalHeight / img.naturalWidth;
	}
</script>

<article
	class="flex flex-col overflow-hidden rounded-xl bg-olf-eggshell shadow-md {compact
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
			<div class="flex min-w-0 flex-col gap-0.5">
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
								size={16}
								class={i < post.rating ? 'fill-olf-yolk text-olf-yolk' : 'text-olf-darkbrown/25'}
							/>
						{/each}
					</span>
				{/if}
			</div>
			<time
				datetime={String(post.createdAt)}
				class="ml-auto shrink-0 self-start font-oswald text-xxs text-olf-darkbrown/45"
			>
				{formatRelative(post.createdAt)}
			</time>
		</div>

		<div class="flex items-center gap-1.5">
			<!-- Title + body -->
			<p class="line-clamp-2 font-oswald font-bold tracking-wide text-olf-darkbrown">
				{post.title}
			</p>

			<p class="text-xxs">{post.category ? CATEGORY_EMOJI[post.category] : '🌳'}</p>
			<!-- Category tag (when no thumbnail carried it) -->
			{#if post.category}
				<span
					class="rounded-lg px-1.5 py-0.5 text-xxs font-normal tracking-wider uppercase {CATEGORY_COLOR[
						post.category
					]}"
				>
					{categoryLabel(post.category)}
				</span>
			{/if}
		</div>

		{#if post.body}
			{#if !compact}
				<p class="line-clamp-3 font-oswald text-[0.95rem] tracking-wide text-olf-darkbrown/90">
					{post.body}
				</p>
			{:else}
				<p
					class="line-clamp-3 truncate font-oswald text-[0.95rem] tracking-wide text-olf-darkbrown/90"
				>
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
		<div
			bind:clientWidth={boxW}
			class="relative w-full overflow-hidden bg-olf-lightbrown transition-[height] duration-300 ease-out motion-reduce:transition-none"
			style="height: {boxH}px"
		>
			<img
				src={thumb.url}
				alt={post.title}
				onload={onImgLoad}
				class="h-full w-full object-cover"
				loading="lazy"
			/>
			{#if !post.moderated}
				<span
					class="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 font-oswald text-xxs font-bold tracking-widest text-white uppercase"
				>
					{m.posts_unmoderated()}
				</span>
			{/if}
			<button
				type="button"
				onclick={() => (expanded = !expanded)}
				aria-label={expanded ? m.posts_image_collapse() : m.posts_image_expand()}
				class="absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/75"
			>
				{#if expanded}
					<Minimize2 size={15} />
				{:else}
					<Maximize2 size={15} />
				{/if}
			</button>
		</div>
	{/if}
	<div class="flex items-center justify-between bg-olf-darkgreen px-3 py-1.5 text-white">
		<span class="flex shrink-0 items-center gap-2 font-oswald text-xs text-olf-eggshell">
			<MessageSquare size={18} class="text-white" />
			<span class="tabular-nums">{post.commentCount}</span>
		</span>
		<span class="flex shrink-0 items-center gap-2.5 font-oswald text-xs text-olf-eggshell">
			<ArrowBigUp size={20} class="text-white" />
			<span class="tabular-nums">{net}</span>
			<ArrowBigDown size={20} class="text-white" />
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
