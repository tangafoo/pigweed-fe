<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import DeliveryCalendar from '$lib/components/DeliveryCalendar.svelte';
	import RollingNumber from '$lib/components/RollingNumber.svelte';
	import { CalendarHeart, Sparkles, Pause, Play } from '@lucide/svelte';
	import { fade } from 'svelte/transition';
	import { tilt } from '$lib/actions/tilt';
	import { eggStats, eggTrivia } from '$lib/eggFacts';
	import type { SubscriptionSummary, SubscriptionStats } from '@meteorclass/pigweed-contract';

	interface SubscriptionCardProps {
		subscription: SubscriptionSummary;
		stats: SubscriptionStats;
	}
	let { subscription: sub, stats }: SubscriptionCardProps = $props();

	const PHONE = '60172332992';
	const period = (cw: number) => (cw === 1 ? m.subscribe_per_week() : m.subscribe_per_fortnight());

	// Egg journey.
	const eggs = $derived(stats.totalEggs ?? 0);
	const facts = $derived(eggStats(eggs));
	const trivia = $derived(eggTrivia(eggs));
	const startedLabel = $derived(
		new Date(sub.startedAt).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})
	);
	const deliveryDayName = $derived(
		new Date(2024, 0, 7 + sub.deliveryDay).toLocaleDateString(undefined, { weekday: 'long' })
	);
	const requestDayUrl = $derived(
		`https://wa.me/${PHONE}?text=${encodeURIComponent(m.subscribe_request_day_message())}`
	);

	// Rotating fun-fact carousel — one fact at a time, auto-advancing, with dots.
	let factIndex = $state(0);
	const fact = $derived(facts.length ? facts[factIndex % facts.length] : null);
	$effect(() => {
		if (facts.length <= 1) return;
		const id = setInterval(() => (factIndex = (factIndex + 1) % facts.length), 3500);
		return () => clearInterval(id);
	});

	// Pause / resume request — manual model, so it opens a WhatsApp message.
	const pauseUrl = $derived(
		`https://wa.me/${PHONE}?text=${encodeURIComponent(
			sub.status === 'PAUSED' ? m.subscribe_resume_message() : m.subscribe_pause_message()
		)}`
	);
	const statusLabel = $derived(
		sub.status === 'ACTIVE'
			? m.subscribe_status_active()
			: sub.status === 'PAUSED'
				? m.subscribe_status_paused()
				: m.subscribe_status_canceled()
	);
	const statusClass = $derived(
		sub.status === 'ACTIVE'
			? 'bg-olf-yolk text-olf-darkgreen'
			: sub.status === 'PAUSED'
				? 'bg-olf-eggshell text-olf-darkgreen'
				: 'bg-olf-darkbrown/70 text-olf-beige'
	);
</script>

<div class="grid items-start gap-5 lg:grid-cols-5">
	<!-- Eggs + fun facts — metal-leaf "holo" card with GSAP tilt -->
	<div
		use:tilt
		class="rounded-[2rem] p-[3px] shadow-lg will-change-transform lg:col-span-3"
		style="background: linear-gradient(135deg, #6b8746 0%, #cfe09a 22%, #3f5e2e 50%, #cfe09a 78%, #2c4420 100%);"
	>
		<div
			class="relative overflow-hidden rounded-[1.85rem] p-6 text-olf-beige"
			style="background: linear-gradient(135deg, #2c4420 0%, #3f5e2e 45%, #4a6d36 50%, #3f5e2e 55%, #2c4420 100%);"
		>
			<span
				class="pointer-events-none absolute -top-20 -right-16 text-[21rem] leading-none opacity-10 select-none"
				>🥚</span
			>
			<!-- Hero: the plan — eggs per period -->
			<div class="flex items-start justify-between gap-3">
				<div class="flex flex-col">
					<span class="font-oswald text-xs tracking-widest uppercase opacity-70"
						>{m.subscribe_your_plan()}</span
					>
					<div class="flex items-baseline gap-2">
						<span class="font-supermercado-one text-6xl leading-none text-olf-yolk"
							>{sub.plan.eggsPerDelivery}</span
						>
						<span class="font-oswald text-sm tracking-widest uppercase opacity-80"
							>🥚 {period(sub.plan.cadenceWeeks)}</span
						>
					</div>
				</div>
				<div class="flex shrink-0 items-center gap-2">
					<span
						class="rounded-full px-3 py-1 font-oswald text-xs font-bold tracking-wider uppercase {statusClass}"
						>{statusLabel}</span
					>
					{#if sub.status === 'ACTIVE' || sub.status === 'PAUSED'}
						<a
							href={pauseUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1 rounded-full bg-olf-beige/15 px-3 py-1 font-oswald text-xs font-bold tracking-wider text-olf-beige uppercase transition-colors hover:bg-olf-beige/25"
						>
							{#if sub.status === 'PAUSED'}
								<Play size={12} class="shrink-0" /> {m.subscribe_resume()}
							{:else}
								<Pause size={12} class="shrink-0" /> {m.subscribe_pause()}
							{/if}
						</a>
					{/if}
				</div>
			</div>

			<!-- Secondary: eggs enjoyed so far -->
			<div class="mt-5 flex items-center gap-2">
				<span class="text-lg">🥚</span>
				<span class="font-supermercado-one text-2xl text-olf-beige"
					><RollingNumber text={String(eggs)} /></span
				>
				<span class="font-oswald text-xs tracking-widest uppercase opacity-60"
					>{m.subscribe_stats_eggs_label()}</span
				>
			</div>

			<!-- Interactive fun-fact carousel — one at a time, auto-advancing -->
			{#if fact}
				<div class="mt-5 flex flex-col items-center gap-2">
					<div class="flex min-h-[2.75rem] items-center justify-center">
						{#key factIndex}
							<span
								in:fade={{ duration: 250 }}
								class="flex items-center gap-1.5 rounded-full bg-olf-beige/10 px-4 py-2 font-oswald text-sm"
							>
								<span class="text-base">{fact.icon}</span>{fact.text}
							</span>
						{/key}
					</div>
					{#if facts.length > 1}
						<div class="flex items-center gap-1.5">
							{#each facts as f, i (f.text)}
								<button
									type="button"
									onclick={() => (factIndex = i)}
									aria-label={`Fact ${i + 1}`}
									class="size-1.5 rounded-full transition-colors {factIndex % facts.length === i
										? 'bg-olf-yolk'
										: 'bg-olf-beige/30'}"
								></button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Trivia -->
			<div class="mt-5 flex items-start gap-2 rounded-2xl bg-olf-yolk/15 px-4 py-3">
				<Sparkles size={16} class="mt-0.5 shrink-0 text-olf-yolk" />
				<p class="font-caveat text-lg leading-snug">Did you know? {trivia}</p>
			</div>

			<!-- Holo glare (cursor-tracked by the tilt action) — kept faint so it
			     shimmers without washing out the light text. -->
			<span
				class="pointer-events-none absolute inset-0"
				style="background: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(247,243,232,0.12), transparent 32%); opacity: var(--glare, 0); transition: opacity 0.3s; mix-blend-mode: soft-light;"
			></span>
		</div>
	</div>

	<!-- Delivery calendar -->
	<div
		class="flex flex-col gap-3 rounded-[2rem] bg-olf-moss p-5 text-olf-beige shadow-lg lg:col-span-2"
	>
		<div class="flex flex-col items-center gap-0.5 text-center">
			<CalendarHeart size={22} class="text-olf-yolk" />
			<p class="font-oswald text-sm">{m.subscribe_since({ date: startedLabel })}</p>
			<p class="font-oswald text-xs tracking-widest uppercase opacity-80">
				{m.subscribe_delivery_every({ day: deliveryDayName })}
			</p>
		</div>
		<DeliveryCalendar deliveryDay={sub.deliveryDay} />
		<a
			href={requestDayUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="text-center font-oswald text-xs underline opacity-80 hover:opacity-100"
		>
			{m.subscribe_request_day()}
		</a>
	</div>
</div>
