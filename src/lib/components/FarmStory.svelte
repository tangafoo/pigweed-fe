<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import Parallax from '$lib/components/Parallax.svelte';
	import { Sunrise, Sprout, MapPin } from '@lucide/svelte';
	import { asset } from '$lib/assets';

	interface FarmStoryProps {
		// Rendered at the top of the story column, above the copy. The home
		// page slots its account bar here so the photo fills the band's full
		// height instead of leaving the bar stranded in a row above it.
		children?: Snippet;
	}
	let { children }: FarmStoryProps = $props();

	const promises = [
		{ icon: Sunrise, title: m.home_promise_1_title, body: m.home_promise_1_body },
		{ icon: Sprout, title: m.home_promise_2_title, body: m.home_promise_2_body },
		{ icon: MapPin, title: m.home_promise_3_title, body: m.home_promise_3_body }
	];
</script>

<section class="flex flex-col bg-olf-beige lg:flex-row">
	<div class="flex flex-1 flex-col">
		{@render children?.()}
		<div class="flex flex-1 flex-col justify-center gap-3 px-6 py-12">
			<p class="font-oswald text-xs tracking-[0.25em] text-olf-darkgreen uppercase">
				{m.home_story_kicker()}
			</p>
			<h2 class="font-homemade-apple text-3xl leading-snug text-olf-darkbrown">
				{m.home_story_heading()}
			</h2>
			<p class="font-oswald text-sm leading-relaxed text-olf-darkbrown/80">
				{m.home_story_body()}
			</p>
		</div>
	</div>
	<Parallax src={asset('chicken houses.webp')} class="h-56 w-full lg:h-auto lg:w-2/5" />
</section>

<section class="bg-olf-darkgreen px-6 py-12 text-olf-beige">
	<p class="text-center font-oswald text-xs tracking-[0.25em] text-olf-lightgreen uppercase">
		{m.home_promise_kicker()}
	</p>
	<h2 class="mt-1 text-center font-homemade-apple text-3xl">
		{m.home_promise_heading()}
	</h2>
	<div class="mt-8 flex flex-col gap-8 lg:flex-row lg:gap-6">
		{#each promises as p, i (i)}
			{@const Icon = p.icon}
			<div class="flex flex-1 flex-col items-center gap-2 text-center">
				<Icon size={36} strokeWidth={1.5} class="text-olf-lightgreen" />
				<p class="font-supermercado-one text-lg">{p.title()}</p>
				<p class="max-w-xs font-oswald text-sm text-olf-beige/75">{p.body()}</p>
			</div>
		{/each}
	</div>
</section>

<section
	class="flex flex-col items-center gap-3 bg-olf-darkbrown px-6 py-12 text-center text-olf-beige"
>
	<p class="font-oswald text-xs tracking-[0.25em] text-olf-lightgreen uppercase">
		{m.home_visit_kicker()}
	</p>
	<h2 class="font-homemade-apple text-3xl">{m.home_visit_heading()}</h2>
	<p class="max-w-md font-oswald text-sm text-olf-beige/80">{m.home_visit_body()}</p>
	<p class="mt-1 flex items-center gap-1.5 font-oswald text-sm tracking-wide">
		<MapPin size={16} class="shrink-0 text-olf-lightgreen" />
		{m.home_visit_location()}
	</p>
</section>
