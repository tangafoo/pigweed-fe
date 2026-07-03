<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages.js';
	import { asset } from '$lib/config/assets';

	// The farm's chicken drawings — one greets you on every error. Picked
	// DETERMINISTICALLY from the path (not Math.random) so SSR and hydration
	// agree on which bird shows up (a random pick would mismatch and flicker).
	const CHICKENS = [
		'henkerchief.webp',
		'hen with chicks.webp',
		'chicken-drawing-white.webp',
		'chicken-drawing-brown.webp'
	] as const;
	const art = $derived(CHICKENS[page.url.pathname.length % CHICKENS.length]);

	const is404 = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{page.status} · Our Little Farm</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div
	class="flex flex-1 flex-col items-center justify-center gap-4 bg-olf-lightgreen px-6 py-20 text-center"
>
	<img src={asset(art)} alt="" class="chicken w-36 object-contain sm:w-44" draggable="false" />

	<p class="font-oswald text-xs font-bold tracking-[0.3em] text-olf-darkgreen/60 uppercase">
		{page.status}
	</p>
	<h1 class="font-homemade-apple text-4xl leading-snug text-olf-darkbrown">
		{is404 ? m.error_404_title() : m.error_generic_title()}
	</h1>
	<p class="max-w-sm font-oswald text-olf-darkbrown/70">
		{is404 ? m.error_404_body() : m.error_generic_body()}
	</p>

	<a
		href="/"
		class="mt-2 rounded-full bg-olf-darkbrown px-6 py-2.5 font-oswald font-bold tracking-wider text-olf-beige uppercase transition-transform hover:scale-105"
	>
		🐓 {m.error_home_button()}
	</a>
</div>

<style>
	/* The lost chicken pecks around while you decide where to go. One peck
	   round plays in the first ~2.4s, then it rests ~4.2s before the next
	   loop (motion squeezed into the first 36% of a 6.6s cycle). */
	.chicken {
		transform-origin: 50% 90%;
		animation: lost-peck 6.6s ease-in-out infinite;
	}
	@keyframes lost-peck {
		0%,
		20%,
		36%,
		100% {
			transform: translateY(0) rotate(0deg);
		}
		5.5% {
			transform: translateY(3px) rotate(-5deg);
		}
		11% {
			transform: translateY(1px) rotate(3deg);
		}
		25.5% {
			transform: translateY(-4px) rotate(2deg);
		}
		28.5% {
			transform: translateY(0) rotate(0deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.chicken {
			animation: none;
		}
	}
</style>
