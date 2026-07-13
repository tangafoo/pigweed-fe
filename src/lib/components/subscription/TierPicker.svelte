<script lang="ts">
	import { untrack } from 'svelte';
	import { scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { m } from '$lib/paraglide/messages.js';
	import { whatsappUrl } from '$lib/config/contact';
	import { Check } from '@lucide/svelte';
	import type {
		SubscriptionPlanWithBenefits,
		SubscriptionSummary
	} from '@meteorclass/pigweed-contract';

	interface TierPickerProps {
		plans: SubscriptionPlanWithBenefits[];
		/** The viewer's current subscription, when they have one — drives the "current tier" badge + heading. */
		subscription?: SubscriptionSummary | null;
		/** Show the "choose / change your tier" heading above the grid. */
		showHeading?: boolean;
	}
	let { plans, subscription = null, showHeading = true }: TierPickerProps = $props();

	// Pick a tier → ONE WhatsApp CTA for the selected tier. Manual billing: the
	// admin flips the subscription on after the WhatsApp handshake + payment.
	let selectedId = $state(untrack(() => subscription?.plan.id ?? plans[0]?.id ?? ''));
	const selectedPlan = $derived(plans.find((p) => p.id === selectedId) ?? plans[0] ?? null);

	// One 🥚 per ~15 eggs of the tier (120 → 8, 15 → 1) — a playful visual weight.
	const EGGS_PER_ICON = 15;
	const eggIcons = (eggs: number) => Math.max(1, Math.ceil(eggs / EGGS_PER_ICON));

	// A brief egg-jiggle on select (pure fun, reduced-motion aware via CSS).
	let shakingId = $state<string | null>(null);
	function pick(id: string) {
		selectedId = id;
		shakingId = id;
		setTimeout(() => {
			if (shakingId === id) shakingId = null;
		}, 650);
	}

	const period = (cw: number) => (cw === 1 ? m.subscribe_per_week() : m.subscribe_per_fortnight());
	const priceLabel = (p: { priceCents: number; cadenceWeeks: number }) =>
		`RM${(p.priceCents / 100).toFixed(0)} ${period(p.cadenceWeeks)}`;
	const waUrl = $derived(
		selectedPlan
			? whatsappUrl(
					m.subscribe_whatsapp_message({ name: selectedPlan.name, price: priceLabel(selectedPlan) })
				)
			: '#'
	);
</script>

<div class="flex flex-col gap-5">
	{#if showHeading}
		<h2 class="text-center font-homemade-apple text-3xl text-olf-darkbrown">
			{subscription ? m.subscribe_change_tier_heading() : m.subscribe_choose_tier_heading()}
		</h2>
	{/if}

	<div class="grid gap-4 sm:grid-cols-3">
		{#each plans as p (p.id)}
			{@const active = selectedId === p.id}
			{@const current = subscription?.plan.id === p.id}
			<button
				type="button"
				onclick={() => pick(p.id)}
				class="relative flex flex-col items-center gap-1 rounded-[1.75rem] border-4 bg-olf-eggshell px-4 py-5 text-center transition-all duration-300 hover:-translate-y-0.5 {active
					? 'scale-[1.03] border-olf-yolk shadow-lg'
					: 'border-transparent shadow'}"
			>
				{#if current}
					<span
						class="absolute top-3 right-3 rounded-full bg-olf-yolk px-2 py-0.5 font-oswald text-xxs font-bold tracking-wider text-olf-darkgreen uppercase"
					>
						{m.subscribe_current_tier()}
					</span>
				{/if}
				<!-- Egg stack — one 🥚 per ~15 eggs; jiggles briefly when picked. -->
				<div
					class="flex max-w-[8rem] flex-wrap justify-center gap-0.5 text-lg leading-none {shakingId ===
					p.id
						? 'egg-shake'
						: ''}"
				>
					{#each [...Array(eggIcons(p.eggsPerDelivery)).keys()] as i (i)}
						<span style="animation-delay: {i * 45}ms">🥚</span>
					{/each}
				</div>
				<span class="mt-1 font-supermercado-one text-2xl text-olf-darkgreen"
					>{p.eggsPerDelivery}</span
				>
				<span class="font-oswald text-xs tracking-wide uppercase opacity-60">
					eggs / {p.cadenceWeeks === 1 ? 'week' : '2 weeks'}
				</span>
				<span class="mt-1 font-oswald">
					<span class="text-xl font-bold">RM{(p.priceCents / 100).toFixed(0)}</span>
					<span class="text-xs tracking-wide uppercase opacity-70">{period(p.cadenceWeeks)}</span>
				</span>
				{#if active}
					<span
						in:scale={{ duration: 300, easing: backOut, start: 0.4 }}
						class="mt-1 flex size-6 items-center justify-center rounded-full bg-olf-darkgreen text-olf-beige"
					>
						<Check size={15} />
					</span>
				{/if}
			</button>
		{/each}
	</div>

	<a
		href={waUrl}
		target="_blank"
		rel="noopener noreferrer"
		class="mx-auto flex items-center gap-2 rounded-full bg-olf-darkbrown px-10 py-4 font-oswald text-sm font-bold tracking-widest text-olf-beige uppercase shadow-lg transition-transform hover:scale-105"
	>
		🥚 {m.subscribe_cta()}
	</a>

	{#if selectedPlan && selectedPlan.benefits.length > 0}
		<div class="rounded-[1.75rem] bg-olf-lightgreen/40 p-5">
			<p
				class="mb-3 text-center font-oswald text-sm font-bold tracking-wide text-olf-darkgreen/70 uppercase"
			>
				What you get
			</p>
			<ul class="mx-auto grid max-w-3xl gap-x-6 gap-y-2 sm:grid-cols-2">
				{#each selectedPlan.benefits as b (b.id)}
					<li class="flex items-start gap-2 font-oswald text-sm text-olf-darkgreen">
						<Check size={16} class="mt-0.5 shrink-0 text-olf-moss" />
						<span>{b.label}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="flex flex-col items-center gap-2">
		<p class="text-center font-oswald text-xs font-light tracking-widest uppercase opacity-70">
			{m.subscribe_manual_note()}
		</p>
	</div>
</div>

<style>
	/* Playful egg jiggle on tier select — each egg staggered via inline delay. */
	.egg-shake span {
		animation: egg-shake 0.5s ease-in-out;
	}
	@keyframes egg-shake {
		0%,
		100% {
			transform: translateY(0) rotate(0);
		}
		25% {
			transform: translateY(-4px) rotate(-12deg);
		}
		60% {
			transform: translateY(1px) rotate(9deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.egg-shake span {
			animation: none;
		}
	}
</style>
