<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { MapPin } from '@lucide/svelte';
	import Parallax from '$lib/components/decor/Parallax.svelte';
	import { asset } from '$lib/config/assets';
	import { MANTIN_COORDS } from '$lib/config/seo';

	const { lat, lng } = MANTIN_COORDS;

	// Google Maps embed (no API key needed via `output=embed`). The link uses the
	// universal Maps URL: on a phone it opens the Google Maps app straight to the
	// farm pin for turn-by-turn; on desktop it opens maps.google.com.
	const embedSrc = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
	const fullMapHref = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
</script>

<Parallax src={asset('chickens-eating-cucumber.webp')} class="h-64 w-full lg:h-[21rem]" />

<section
	class="flex flex-col items-center gap-3 bg-olf-darkbrown px-6 py-12 text-center text-olf-beige"
>
	<p class="font-oswald text-xs tracking-[0.25em] text-olf-lightgreen uppercase">
		{m.home_visit_kicker()}
	</p>
	<h2 class="font-homemade-apple text-3xl">{m.home_visit_heading()}</h2>
	<p class="max-w-md font-oswald text-[0.95rem] tracking-wide text-olf-beige/85">
		{m.home_visit_body()}
	</p>
	<p class="mt-1 flex items-center gap-1.5 font-oswald text-sm tracking-wide">
		<MapPin size={16} class="shrink-0 text-olf-lightgreen" />
		{m.home_visit_location()}
	</p>

	<div class="mt-4 w-full max-w-2xl overflow-hidden rounded-2xl border-4 border-olf-lightgreen">
		<iframe
			title={m.home_visit_map_title()}
			src={embedSrc}
			loading="lazy"
			class="block h-64 w-full lg:h-80"
		></iframe>
	</div>
	<a
		href={fullMapHref}
		target="_blank"
		rel="noopener noreferrer"
		class="font-oswald text-xs tracking-wide text-olf-lightgreen underline underline-offset-4 hover:text-olf-beige"
	>
		{m.home_visit_view_map()}
	</a>
</section>
