<script lang="ts">
	import type { PageData } from './$types';
	import type { PostCategory, Post } from '@meteorclass/pigweed-contract';
	import { fetchFeed } from '$lib/api/posts';

	import PostCard from '$lib/components/PostCard.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import FilterDropdown from '$lib/components/FilterDropdown.svelte';

	import { m } from '$lib/paraglide/messages.js';
	import { Plus, Star } from '@lucide/svelte';
	import { CATEGORY_COLOR, CATEGORY_EMOJI } from '$lib/categories';

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
	let minRating = $state<number | null>(null);
	let loading = $state(false);
	let errored = $state(false);

	async function refetch() {
		loading = true;
		errored = false;
		try {
			const feed = await fetchFeed({
				sort: 'newest',
				limit: 30,
				...(category ? { category } : {}),
				...(minRating != null ? { minRating } : {})
			});
			override = feed.posts;
		} catch {
			errored = true;
		} finally {
			loading = false;
		}
	}

	function selectCategory(value: PostCategory | null) {
		if (value === category) return;
		category = value;
		refetch();
	}

	function selectRating(value: number | null) {
		if (value === minRating) return;
		minRating = value;
		refetch();
	}

	// Current-selection labels for the two filter dropdown triggers.
	const categoryTriggerLabel = $derived(
		CATEGORIES.find((c) => c.value === category)?.label() ?? m.posts_cat_all()
	);
	const ratingTriggerLabel = $derived(
		minRating == null ? m.posts_rating_all() : `${minRating}★+`
	);
</script>

<Seo
	title="The farm — Our Little Farm"
	description="See what the animals are saying — fresh posts and reviews from the Our Little Farm community."
/>

<div class="flex-1 bg-olf-lightgreen px-4 py-8 sm:px-6">
	<div class="mx-auto max-w-5xl">
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
								<span class="w-5 shrink-0 text-center">{c.value ? CATEGORY_EMOJI[c.value] : '🌳'}</span>
								<span>{c.label()}</span>
							</button>
						</li>
					{/each}
				{/snippet}
			</FilterDropdown>

			<FilterDropdown label={ratingTriggerLabel}>
				{#snippet children(close)}
					<li>
						<button
							type="button"
							role="option"
							aria-selected={minRating === null}
							onclick={() => {
								selectRating(null);
								close();
							}}
							class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left font-oswald text-sm text-olf-darkbrown transition-colors hover:bg-olf-darkgreen/10 {minRating ===
							null
								? 'font-bold'
								: ''}"
						>
							{m.posts_rating_all()}
						</button>
					</li>
					{#each [1, 2, 3, 4, 5] as r (r)}
						<li>
							<button
								type="button"
								role="option"
								aria-selected={minRating === r}
								aria-label={m.posts_rating_min({ rating: r })}
								onclick={() => {
									selectRating(r);
									close();
								}}
								class="flex w-full cursor-pointer items-center gap-1 rounded-lg px-3 py-2 text-left font-oswald text-sm text-olf-darkbrown transition-colors hover:bg-olf-darkgreen/10 {minRating ===
								r
									? 'font-bold'
									: ''}"
							>
								{r}<Star size={13} class="fill-olf-yolk text-olf-darkgreen" />+
							</button>
						</li>
					{/each}
				{/snippet}
			</FilterDropdown>
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
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each posts as post (post.id)}
					<PostCard {post} />
				{/each}
			</div>
		{/if}
	</div>
</div>
