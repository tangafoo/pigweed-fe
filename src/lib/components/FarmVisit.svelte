<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { MapPin } from '@lucide/svelte';
	import Parallax from '$lib/components/Parallax.svelte';
	import { asset } from '$lib/assets';
	import { MANTIN_COORDS } from '$lib/seo';

	const { lat, lng } = MANTIN_COORDS;

	// A small bounding box around the farm keeps the embed zoomed in on the
	// gate rather than the whole district. OSM's export embed needs the box
	// as min/max lng/lat plus a marker at the exact pin.
	const pad = 0.012;
	const bbox = `${lng - pad},${lat - pad},${lng + pad},${lat + pad}`;
	const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
	const fullMapHref = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
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
