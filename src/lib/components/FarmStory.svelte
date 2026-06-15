<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import Parallax from '$lib/components/Parallax.svelte';
	import { asset } from '$lib/assets';

	interface FarmStoryProps {
		// Rendered at the top of the story column, above the copy. The home
		// page slots its account bar here so the photo fills the band's full
		// height instead of leaving the bar stranded in a row above it.
		children?: Snippet;
	}
	let { children }: FarmStoryProps = $props();
</script>

<section class="flex flex-col bg-olf-beige lg:flex-row">
	<div class="flex flex-1 flex-col">
		{@render children?.()}
		<div class="flex flex-1 flex-col justify-center gap-3 px-6 py-8 pb-12">
			<img src={asset('chicken-drawing-white.webp')} alt="" class="mr-auto mb-2 w-18 lg:w-24" />
			<p class="font-oswald text-xs tracking-[0.25em] text-olf-darkgreen uppercase">
				{m.home_story_kicker()}
			</p>
			<h2 class="font-homemade-apple text-3xl leading-snug text-olf-darkbrown">
				{m.home_story_heading()}
			</h2>
			<p class="font-oswald text-sm leading-relaxed text-olf-darkbrown/80">
				{m.home_story_body_1()}
			</p>
			<p class="font-oswald text-sm leading-relaxed text-olf-darkbrown/80">
				{m.home_story_body_2()}
			</p>
			<p class="mt-1 font-oswald text-sm font-light text-olf-darkbrown/55 italic">
				{m.home_eggs_price()}
			</p>
		</div>
	</div>
	<Parallax src={asset('chickens-eating-cucumber02.webp')} class="h-56 w-full lg:h-auto lg:w-2/5" />
</section>
