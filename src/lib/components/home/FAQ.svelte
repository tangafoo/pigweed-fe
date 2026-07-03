<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { asset } from '$lib/config/assets';
	import { orderModal } from '$lib/stores/orderModal.svelte';
	import JsonLd from '$lib/components/seo/JsonLd.svelte';
	import { Egg, Plus } from '@lucide/svelte';
	import { slide } from 'svelte/transition';

	// `orderCta` puts an "Order Eggs" button under the answer — the "How do I
	// order?" panel shouldn't make people hunt for the actual order flow.
	const items = [
		{ q: m.home_faq_q1, a: m.home_faq_a1 },
		{ q: m.home_faq_q2, a: m.home_faq_a2 },
		{ q: m.home_faq_q3, a: m.home_faq_a3, orderCta: true },
		{ q: m.home_faq_q4, a: m.home_faq_a4 },
		{ q: m.home_faq_q5, a: m.home_faq_a5 }
	];

	// FAQPage rich result — lets Google (and AI answer engines) surface these
	// answers directly. Mirrors the visible copy above.
	const faqJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: items.map((item) => ({
			'@type': 'Question',
			name: item.q(),
			acceptedAnswer: { '@type': 'Answer', text: item.a() }
		}))
	};

	// One panel open at a time (classic accordion). `null` = all closed.
	let openIndex = $state<number | null>(null);
	// Set by the `hopOnClick` action once GSAP loads; replays the hen's hop on
	// every accordion toggle. No-op until ready / under reduced-motion.
	let playHop: (() => void) | undefined;
	const toggle = (i: number) => {
		openIndex = openIndex === i ? null : i;
		playHop?.();
	};

	// Honor reduced-motion — Svelte transitions don't gate themselves.
	// Evaluated once on the client; SSR (no window) just renders closed.
	const slideMs =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
			? 0
			: 250;

	// FAQ hen (faces left): a tiny up-and-left hop with a slight left tilt, then
	// settle back. Plays once per accordion click (wired through `playHop`),
	// not on a loop. Async GSAP, pivots at the feet, reduced-motion aware.
	const hopOnClick = (node: HTMLElement) => {
		let tl: gsap.core.Timeline | undefined;

		(async () => {
			if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
			const { gsap } = await import('gsap');
			gsap.set(node, { transformOrigin: '50% 100%' });
			tl = gsap
				.timeline({ paused: true })
				.to(node, { x: -3, y: -4, rotation: -5, duration: 0.45, ease: 'power2.out' })
				.to(node, { x: 0, y: 0, rotation: 0, duration: 0.22, ease: 'power2.in' });
			playHop = () => tl?.restart();
		})();

		return { destroy: () => tl?.kill() };
	};
</script>

<JsonLd data={faqJsonLd} />

<section class="bg-olf-beige px-6 py-12">
	<div class="mx-auto flex max-w-2xl flex-col gap-3">
		<div class="flex items-end gap-4">
			<div class="flex flex-col gap-3">
				<p class="font-oswald text-xs tracking-[0.25em] text-olf-darkgreen uppercase">
					{m.home_faq_kicker()}
				</p>
				<h2 class="font-homemade-apple text-3xl leading-snug text-olf-darkbrown">
					{m.home_faq_heading()}
				</h2>
			</div>
			<img
				use:hopOnClick
				src={asset('chicken-drawing-brown.webp')}
				alt=""
				class="ml-auto w-24 shrink-0 lg:w-32"
			/>
		</div>

		{#each items as item, i (item.q)}
			<div class="border-b border-olf-darkgreen/20 py-3">
				<button
					type="button"
					onclick={() => toggle(i)}
					aria-expanded={openIndex === i}
					aria-controls="faq-panel-{i}"
					class="flex w-full cursor-pointer items-center justify-between gap-3 text-left font-oswald font-bold text-olf-darkbrown"
				>
					{item.q()}
					<Plus
						size={18}
						class="shrink-0 text-olf-darkgreen transition-transform duration-200 {openIndex === i
							? 'rotate-45'
							: ''}"
					/>
				</button>
				{#if openIndex === i}
					<div id="faq-panel-{i}" transition:slide={{ duration: slideMs }} class="pt-2">
						<p class="font-oswald text-sm leading-relaxed text-olf-darkgreen/80">
							{item.a()}
						</p>
						{#if item.orderCta}
							<button
								type="button"
								onclick={() => (orderModal.open = true)}
								class="mt-3 flex items-center gap-1.5 rounded-full bg-olf-darkbrown px-4 py-1.5 font-oswald text-sm font-bold tracking-wider text-olf-beige uppercase transition-transform hover:scale-105"
							>
								<Egg size={15} class="shrink-0" />
								{m.home_order_eggs()}
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</section>
