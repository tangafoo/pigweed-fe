<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { MapPin } from '@lucide/svelte';
	import Parallax from '$lib/components/Parallax.svelte';
	import { asset } from '$lib/assets';
</script>

<Parallax src={asset('chickens-eating-cucumber.webp')} class="h-56 w-full lg:h-72" />

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
