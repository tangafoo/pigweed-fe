<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { asset } from '$lib/assets';

	interface FarmYolkProps {
		// Which egg photo (1–4) to show — chosen randomly in the page load.
		eggNum: number;
	}
	let { eggNum }: FarmYolkProps = $props();

	// Egg layers, outer → in. Each maps to a labelled point and a swatch that
	// echoes the matching part of the egg photo beside it.
	const layers = [
		{ swatch: 'bg-olf-eggshell', title: m.home_yolk_shell_title, body: m.home_yolk_shell_body },
		{ swatch: 'bg-white', title: m.home_yolk_white_title, body: m.home_yolk_white_body },
		{ swatch: 'bg-olf-yolk', title: m.home_yolk_yolk_title, body: m.home_yolk_yolk_body }
	];

	const eggSrc = $derived(asset(`egg0${eggNum}.webp`));
</script>

<section class="bg-olf-lightgreen px-6 py-12">
	<div class="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center">
		<p class="font-oswald text-xs tracking-[0.25em] text-olf-darkgreen uppercase">
			{m.home_yolk_kicker()}
		</p>
		<h2 class="font-homemade-apple text-3xl leading-snug text-olf-darkbrown">
			{m.home_yolk_heading()}
		</h2>
		<p class="max-w-xl font-oswald text-sm leading-relaxed text-olf-darkgreen/80">
			{m.home_yolk_intro()}
		</p>
	</div>

	<div class="mx-auto mt-10 flex max-w-4xl flex-col items-center gap-10 lg:flex-row lg:gap-14">
		<img
			src={eggSrc}
			alt={m.home_yolk_heading()}
			class="h-auto w-full max-w-sm shrink-0 rounded-2xl"
		/>

		<ul class="flex flex-col gap-5">
			{#each layers as layer (layer.title)}
				<li class="flex gap-3">
					<span
						class="mt-1 size-4 shrink-0 rounded-full border border-olf-darkbrown/30 {layer.swatch}"
					></span>
					<div class="flex flex-col">
						<p class="font-oswald font-bold text-olf-darkbrown">{layer.title()}</p>
						<p class="font-oswald text-sm leading-relaxed text-olf-darkgreen/80">{layer.body()}</p>
					</div>
				</li>
			{/each}
		</ul>
	</div>
</section>
