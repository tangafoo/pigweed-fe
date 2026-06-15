<script lang="ts">
	import type { PageData } from './$types';
	import type { PostCategory, Post } from '@meteorclass/pigweed-contract';
	import { fetchFeed } from '$lib/api/posts';

	import PostCard from '$lib/components/PostCard.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Seo from '$lib/components/Seo.svelte';

	import { m } from '$lib/paraglide/messages.js';
	import { Plus, Star } from '@lucide/svelte';

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

		<!-- Category sections -->
		<div class="mb-3 flex flex-wrap gap-2">
			{#each CATEGORIES as c (c.value ?? 'all')}
				<button
					type="button"
					onclick={() => selectCategory(c.value)}
					class="rounded-full px-4 py-1.5 font-oswald text-sm font-bold {category === c.value
						? 'bg-olf-darkgreen text-white'
						: 'bg-olf-beige text-olf-darkbrown'}"
				>
					{c.label()}
				</button>
			{/each}
		</div>

		<!-- Star filter -->
		<div class="mb-6 flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={() => selectRating(null)}
				class="rounded-full px-3 py-1 font-oswald text-xs font-bold {minRating === null
					? 'bg-olf-darkbrown text-white'
					: 'bg-olf-beige text-olf-darkbrown'}"
			>
				{m.posts_rating_all()}
			</button>
			{#each [1, 2, 3, 4, 5] as r (r)}
				<button
					type="button"
					onclick={() => selectRating(r)}
					aria-label={m.posts_rating_min({ rating: r })}
					class="flex items-center gap-0.5 rounded-full px-3 py-1 font-oswald text-xs font-bold {minRating ===
					r
						? 'bg-olf-darkbrown text-white'
						: 'bg-olf-beige text-olf-darkbrown'}"
				>
					{r}<Star
						size={12}
						class={minRating === r
							? 'fill-white text-white'
							: 'fill-olf-darkgreen text-olf-darkgreen'}
					/>+
				</button>
			{/each}
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
