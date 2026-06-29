<script lang="ts">
	import type { PageData } from './$types';
	import type { PostCategory, Post } from '@meteorclass/pigweed-contract';
	import { fetchFeed } from '$lib/api/posts';

	import PostCard from '$lib/components/PostCard.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import FilterDropdown from '$lib/components/FilterDropdown.svelte';

	import { m } from '$lib/paraglide/messages.js';
	import { Plus, Star, MapPin, Globe, X } from '@lucide/svelte';
	import { CATEGORY_COLOR, CATEGORY_EMOJI } from '$lib/categories';
	import { getViewerPosition, type LatLng } from '$lib/geo';
	import { MANTIN_COORDS } from '$lib/seo';

	let { data }: { data: PageData } = $props();
	const session = $derived(data.session);

	// All categories live in one section row; `null` = "All".
	const CATEGORIES: { value: PostCategory | null; label: () => string }[] = [
		{ value: null, label: () => m.posts_cat_all() },
		{ value: 'EGGS', label: () => m.posts_cat_eggs() },
		{ value: 'VEGGIES', label: () => m.posts_cat_veggies() },
		{ value: 'FRUITS', label: () => m.posts_cat_fruits() },
		{ value: 'ANIMALS', label: () => m.posts_cat_animals() }
	];

	// Seed from the SSR load; `override` holds client-refetched results once
	// the user touches a filter, so `data` stays reactive (no stale capture).
	let override = $state<Post[] | null>(null);

	const posts = $derived(override ?? data.feed.posts);
	let category = $state<PostCategory | null>(null);
	// Max-rating filter: "N stars and below" — surfaces the low/critical reviews.
	// Filtered server-side via the feed's ?maxRating= param (the BE excludes
	// non-reviews from a <= bound, same as the other filters).
	let maxRating = $state<number | null>(null);
	let loading = $state(false);
	let errored = $state(false);

	// Location-bounding. Off by default (the SSR load is browse-all/unbounded).
	// When on, we pass the viewer's coords + radius to the feed so the BE
	// filters via ST_DWithin — the hyperlocal core. Viewer coords are resolved
	// once and kept in memory only (never persisted).
	const RADIUS_KM = 100;
	let nearMe = $state(false);
	let viewerCoords = $state<LatLng | null>(null);
	let locating = $state(false);

	async function refetch() {
		loading = true;
		errored = false;
		try {
			const feed = await fetchFeed({
				sort: 'newest',
				limit: 30,
				...(category ? { category } : {}),
				...(maxRating != null ? { maxRating } : {}),
				// Only bound the feed when "Near me" is on and we have coords.
				...(nearMe && viewerCoords
					? { lat: viewerCoords.lat, lng: viewerCoords.lng, radius: RADIUS_KM }
					: {})
			});
			override = feed.posts;
		} catch {
			errored = true;
		} finally {
			loading = false;
		}
	}

	// Pick "Near me" (radius-bounded) or "Everywhere" (browse-all). Switching
	// to Near me resolves the viewer's location once, falling back to the farm
	// if geolocation is denied/unavailable (same honest fallback as the
	// new-post form) so it never silently fails.
	async function selectLocation(near: boolean) {
		if (near === nearMe) return;
		if (near && !viewerCoords) {
			locating = true;
			try {
				viewerCoords = await getViewerPosition();
			} catch {
				viewerCoords = { lat: MANTIN_COORDS.lat, lng: MANTIN_COORDS.lng };
			} finally {
				locating = false;
			}
		}
		nearMe = near;
		refetch();
	}

	function selectCategory(value: PostCategory | null) {
		if (value === category) return;
		category = value;
		refetch();
	}

	// Clicking the active value again clears it back to "all". Refetches since
	// the rating filter now runs on the BE.
	function selectRating(value: number | null) {
		const next = maxRating === value ? null : value;
		if (next === maxRating) return;
		maxRating = next;
		refetch();
	}

	// Any non-default filter active? Drives the active-filter chips + Clear.
	const hasFilters = $derived(nearMe || category != null || maxRating != null);

	// Reset every filter at once and refetch the unbounded, unfiltered feed.
	function clearFilters() {
		if (!hasFilters) return;
		category = null;
		maxRating = null;
		nearMe = false;
		refetch();
	}

	// Current-selection labels for the two filter dropdown triggers.
	const categoryTriggerLabel = $derived(
		CATEGORIES.find((c) => c.value === category)?.label() ?? m.posts_cat_all()
	);
	const ratingTriggerLabel = $derived(
		maxRating == null ? m.posts_rating_all() : m.posts_rating_max({ rating: maxRating })
	);

	// Removable active-filter chip; clicking it clears that one filter.
	const CHIP =
		'inline-flex cursor-pointer items-center gap-1 rounded-full bg-olf-darkgreen/15 px-2.5 py-1 font-oswald text-xs font-bold text-olf-darkgreen transition-colors hover:bg-olf-darkgreen/25';
</script>

<!-- Renders a localized rating label with a real gold Lucide star in place of
     the ★ token in the message (so word order stays correct per locale, e.g.
     "Up to 2★" vs "2★ 이하"). No ★ in the text → renders plain (e.g. "Any rating"). -->
{#snippet ratingStars(text: string)}
	{@const parts = text.split('★')}
	{#each parts as part, i (i)}{part}{#if i < parts.length - 1}<Star
				size={13}
				class="mx-0.5 inline-block fill-olf-yolk align-[-2px] text-olf-yolk"
			/>{/if}{/each}
{/snippet}

<Seo
	title="The farm — Our Little Farm"
	description="See what the animals are saying — fresh posts and reviews from the Our Little Farm community."
/>

<div class="flex-1 bg-olf-lightgreen px-4 py-8 sm:px-6">
	<div class="w-full">
		<div class="mb-6 flex items-center justify-between gap-3">
			<h1 class="font-homemade-apple text-3xl font-bold text-olf-darkgreen">
				{m.posts_page_title()}
			</h1>
			{#if session}
				<a
					href="/posts/new"
					class="flex shrink-0 items-center gap-1.5 rounded-full bg-olf-darkbrown px-4 py-2 font-oswald text-sm font-bold tracking-wider text-olf-beige uppercase"
				>
					<Plus size={16} class="shrink-0" />
					{m.posts_new_button()}
				</a>
			{:else}
				<a
					href="/login"
					class="flex shrink-0 items-center gap-1.5 rounded-full bg-olf-darkbrown px-4 py-2 font-oswald text-sm font-bold tracking-wider text-olf-beige uppercase"
				>
					{m.posts_signin_to_post()}
				</a>
			{/if}
		</div>

		<!-- Filters: compact dropdowns instead of two wrapping chip rows. -->
		<div class="mb-6 flex flex-wrap items-center gap-2">
			<!-- Location bounding: an explicit dropdown (matches the category/rating
			     filters) so it reads as a selector, not a mystery button. -->
			<FilterDropdown
				label={locating ? m.posts_locating() : nearMe ? m.posts_near_me() : m.posts_everywhere()}
				triggerClass={nearMe
					? 'bg-olf-darkgreen text-olf-eggshell'
					: 'bg-olf-beige text-olf-darkbrown'}
			>
				{#snippet children(close)}
					<li>
						<button
							type="button"
							role="option"
							aria-selected={!nearMe}
							onclick={() => {
								selectLocation(false);
								close();
							}}
							class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left font-oswald text-sm text-olf-darkbrown transition-colors hover:bg-olf-darkgreen/10 {!nearMe
								? 'font-bold'
								: ''}"
						>
							<Globe size={15} class="w-5 shrink-0" />
							<span>{m.posts_everywhere()}</span>
						</button>
					</li>
					<li>
						<button
							type="button"
							role="option"
							aria-selected={nearMe}
							onclick={() => {
								selectLocation(true);
								close();
							}}
							class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left font-oswald text-sm text-olf-darkbrown transition-colors hover:bg-olf-darkgreen/10 {nearMe
								? 'font-bold'
								: ''}"
						>
							<MapPin size={15} class="w-5 shrink-0" />
							<span>{m.posts_near_me()}</span>
						</button>
					</li>
				{/snippet}
			</FilterDropdown>

			<FilterDropdown
				label={categoryTriggerLabel}
				triggerClass={category ? CATEGORY_COLOR[category] : 'bg-olf-beige text-olf-darkbrown'}
			>
				{#snippet children(close)}
					{#each CATEGORIES as c (c.value ?? 'all')}
						<li>
							<button
								type="button"
								role="option"
								aria-selected={category === c.value}
								onclick={() => {
									selectCategory(c.value);
									close();
								}}
								class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left font-oswald text-sm text-olf-darkbrown transition-colors hover:bg-olf-darkgreen/10 {category ===
								c.value
									? 'font-bold'
									: ''}"
							>
								<span class="w-5 shrink-0 text-center"
									>{c.value ? CATEGORY_EMOJI[c.value] : '🌳'}</span
								>
								<span>{c.label()}</span>
							</button>
						</li>
					{/each}
				{/snippet}
			</FilterDropdown>

			<FilterDropdown label={ratingTriggerLabel}>
				{#snippet labelSnippet()}{@render ratingStars(ratingTriggerLabel)}{/snippet}
				{#snippet children(close)}
					<li>
						<button
							type="button"
							role="option"
							aria-selected={maxRating === null}
							onclick={() => {
								selectRating(null);
								close();
							}}
							class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left font-oswald text-sm text-olf-darkbrown transition-colors hover:bg-olf-darkgreen/10 {maxRating ===
							null
								? 'font-bold'
								: ''}"
						>
							{m.posts_rating_all()}
						</button>
					</li>
					<!-- 1–4 only: "Up to 5★" would equal "Any rating". -->
					{#each [1, 2, 3, 4] as r (r)}
						<li>
							<button
								type="button"
								role="option"
								aria-selected={maxRating === r}
								onclick={() => {
									selectRating(r);
									close();
								}}
								class="flex w-full cursor-pointer items-center gap-1 rounded-lg px-3 py-2 text-left font-oswald text-sm text-olf-darkbrown transition-colors hover:bg-olf-darkgreen/10 {maxRating ===
								r
									? 'font-bold'
									: ''}"
							>
								{@render ratingStars(m.posts_rating_max({ rating: r }))}
							</button>
						</li>
					{/each}
				{/snippet}
			</FilterDropdown>

			<!-- Active-filter chips: shown only when a filter is set. Each chip clears
			     its own filter; "Clear" (pushed right via ml-auto) clears all. The
			     parent flex-wrap lets them wrap to a new line when there are many. -->
			{#if hasFilters}
				{#if nearMe}
					<button type="button" onclick={() => selectLocation(false)} class={CHIP}>
						<MapPin size={12} class="shrink-0" />
						{m.posts_near_me()}
						<X size={12} class="shrink-0 opacity-60" />
					</button>
				{/if}
				{#if category}
					<button type="button" onclick={() => selectCategory(null)} class={CHIP}>
						<span>{CATEGORY_EMOJI[category]}</span>
						{categoryTriggerLabel}
						<X size={12} class="shrink-0 opacity-60" />
					</button>
				{/if}
				{#if maxRating != null}
					<button type="button" onclick={() => selectRating(null)} class={CHIP}>
						{@render ratingStars(ratingTriggerLabel)}
						<X size={12} class="shrink-0 opacity-60" />
					</button>
				{/if}
				<button
					type="button"
					onclick={clearFilters}
					class="ml-auto cursor-pointer font-oswald text-xs font-bold text-olf-darkbrown/70 underline underline-offset-2 transition-colors hover:text-olf-darkbrown"
				>
					{m.posts_new_rating_clear()}
				</button>
			{/if}
		</div>

		<!-- Grid -->
		{#if loading}
			<div class="flex justify-center py-16 text-olf-darkgreen">
				<Spinner />
			</div>
		{:else if errored}
			<p class="rounded-xl bg-olf-beige px-4 py-10 text-center font-oswald text-red-700">
				{m.posts_load_error()}
			</p>
		{:else if posts.length === 0}
			<p class="rounded-xl bg-olf-beige px-4 py-12 text-center font-oswald text-olf-darkbrown/70">
				{m.posts_empty()}
			</p>
		{:else}
			<!-- Pinterest-style masonry: CSS columns so each card keeps its own
			     natural height instead of stretching to a shared grid-row height
			     (which left tall whitespace under short, image-less posts). -->
			<div class="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5">
				{#each posts as post (post.id)}
					<div class="mb-4 break-inside-avoid">
						<PostCard {post} viewerLocation={nearMe ? viewerCoords : null} />
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
