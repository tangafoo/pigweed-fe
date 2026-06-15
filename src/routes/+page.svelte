<script lang="ts">
	import FarmStory from '$lib/components/FarmStory.svelte';
	import FarmYolk from '$lib/components/FarmYolk.svelte';
	import FarmPromise from '$lib/components/FarmPromise.svelte';
	import FarmVisit from '$lib/components/FarmVisit.svelte';
	import FAQ from '$lib/components/FAQ.svelte';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import LatestPostsStrip from '$lib/components/LatestPostsStrip.svelte';
	import NoIcon from '$lib/components/NoIcon.svelte';
	import Parallax from '$lib/components/Parallax.svelte';
	import ProduceOrderButtons from '$lib/components/ProduceOrderButtons.svelte';
	import Seo from '$lib/components/Seo.svelte';

	import { produceSections } from '$lib/produceSections';
	import { asset } from '$lib/assets';
	import {
		MANTIN_COORDS,
		SITE_DESCRIPTION,
		SITE_NAME,
		SITE_OG_DESCRIPTION,
		SITE_OG_IMAGE,
		SITE_TAGLINE,
		SITE_URL
	} from '$lib/seo';
	import { m } from '$lib/paraglide/messages.js';
	import { Sun, CloudRain, HeartCrack, FlaskConical } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const weather = $derived(data.weather);
	const latestPosts = $derived(data.latestPosts);

	// LocalBusiness rich result for the farm — anchors us in Mantin so Google
	// (and AI answer engines) can answer "sustainable farm near KL" with us.
	const farmJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'LocalBusiness',
		name: SITE_NAME,
		url: SITE_URL,
		image: SITE_OG_IMAGE,
		description: SITE_TAGLINE,
		address: {
			'@type': 'PostalAddress',
			addressLocality: 'Mantin',
			addressRegion: 'Negeri Sembilan',
			addressCountry: 'MY'
		},
		geo: {
			'@type': 'GeoCoordinates',
			latitude: MANTIN_COORDS.lat,
			longitude: MANTIN_COORDS.lng
		},
		areaServed: ['Kuala Lumpur', 'Negeri Sembilan', 'Selangor'],
		makesOffer: [
			{ '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Sustainable farm eggs' } },
			{ '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Seasonal vegetables' } },
			{ '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Tree-ripened fruit' } }
		]
	};
</script>

<Seo
	title="Our Little Farm — Sustainable farm in Mantin, Negeri Sembilan"
	description={SITE_DESCRIPTION}
	ogDescription={SITE_OG_DESCRIPTION}
/>
<JsonLd data={farmJsonLd} />

<Parallax
	src={asset('chicken-hero02.webp')}
	srcLg={asset('farm hero.webp')}
	class="flex items-center lg:h-[50dvh]"
>
	<div class="pointer-events-none absolute inset-0 bg-black/35"></div>
	<div class="relative px-6 py-16">
		<div class="relative mb-5 flex">
			<p class="flex-1 font-homemade-apple text-4xl font-bold text-white/95">
				{m.home_hero_title()}
			</p>
			<div class="ml-3 flex flex-col gap-2 self-end lg:flex-row">
				<p
					class="flex items-center gap-1 self-start rounded-full bg-olf-beige/80 px-2 backdrop-blur-md"
				>
					<Sun size={12} class="shrink-0" />
					{weather ? `${weather.temperature}°C` : m.home_weather_heat_fallback()}
				</p>
				<p
					class="flex items-center gap-1 self-start rounded-full bg-olf-beige/80 px-2 backdrop-blur-md"
				>
					<CloudRain size={12} class="shrink-0" />
					{weather
						? m.home_weather_humidity({ value: weather.humidity })
						: m.home_weather_humidity_fallback()}
				</p>
			</div>
		</div>

		<div class="relative flex gap-4">
			<p class="flex flex-col gap-1 text-white/90">
				<NoIcon icon={HeartCrack} size={55} />
				{m.home_no_cruelty()}
			</p>
			<p class="flex flex-col gap-1 text-white/90">
				<NoIcon icon={FlaskConical} size={55} />
				{m.home_no_chemicals()}
			</p>
		</div>
	</div>
</Parallax>

<div class="bg-olf-darkgreen/95 p-2 text-center text-sm tracking-wide text-white/95">
	<p>{m.home_delivery_lead()} • <span class="font-light">{m.home_delivery_schedule()}</span></p>
</div>

{#each produceSections as section (section.heading)}
	<ProduceOrderButtons {...section} />
{/each}

<FarmStory />

<FarmYolk eggNum={data.eggNum} />

<p
	class="bg-olf-beige px-4 py-4 text-center font-oswald text-sm font-medium tracking-wider text-olf-darkgreen uppercase"
>
	{m.home_latest_kicker()}
</p>

<LatestPostsStrip posts={latestPosts} session={data.session} />

<FarmPromise />

<FarmVisit />

<FAQ />
