<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import DeliveryCalendar from '$lib/components/subscription/DeliveryCalendar.svelte';
	import RollingNumber from '$lib/components/ui/RollingNumber.svelte';
	import { CalendarHeart, Sparkles } from '@lucide/svelte';
	import { fade } from 'svelte/transition';
	import { eggStats, eggTrivia } from '$lib/data/eggFacts';
	import { whatsappUrl } from '$lib/config/contact';
	import type { SubscriptionSummary, SubscriptionStats } from '@meteorclass/pigweed-contract';

	// The "egg journey" detail strip shown BELOW the AMEX card on the /subscriptions
	// page — eggs enjoyed, a rotating fun-fact carousel, trivia, and the delivery
	// calendar. Light/playful UI of its own (deliberately not the dark card look);
	// pause/resume now lives on the card face.
	interface SubscriptionExtrasProps {
		subscription: SubscriptionSummary;
		stats: SubscriptionStats;
	}
	let { subscription: sub, stats }: SubscriptionExtrasProps = $props();

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
	const requestDayUrl = $derived(whatsappUrl(m.subscribe_request_day_message()));

	let factIndex = $state(0);
	const fact = $derived(facts.length ? facts[factIndex % facts.length] : null);
	$effect(() => {
		if (facts.length <= 1) return;
		const id = setInterval(() => (factIndex = (factIndex + 1) % facts.length), 3500);
		return () => clearInterval(id);
	});
</script>

<div class="grid items-start gap-5 lg:grid-cols-5">
	<!-- Egg journey: a bright, airy panel that blends with the page -->
	<div
		class="relative flex flex-col gap-5 overflow-hidden rounded-[2rem] border-2 border-olf-yolk/30 bg-olf-eggshell p-6 text-olf-darkgreen shadow-sm lg:col-span-3"
	>
		<!-- Eggs enjoyed — the hero stat -->
		<div class="flex items-center gap-3">
			<span
				class="flex size-14 shrink-0 items-center justify-center rounded-full bg-olf-yolk/25 text-2xl"
				>🥚</span
			>
			<div class="flex flex-col leading-none">
				<span class="font-supermercado-one text-5xl text-olf-darkgreen">
					<RollingNumber text={String(eggs)} />
				</span>
				<span class="mt-1 font-oswald text-xs tracking-[0.2em] text-olf-darkgreen/60 uppercase">
					{m.subscribe_stats_eggs_label()}
				</span>
			</div>
		</div>

		<!-- Rotating fun-fact carousel -->
		{#if fact}
			<div class="flex flex-col items-center gap-2.5">
				<div class="flex min-h-[2.75rem] items-center justify-center">
					{#key factIndex}
						<span
							in:fade={{ duration: 250 }}
							class="flex items-center gap-1.5 rounded-full bg-olf-moss px-4 py-2 font-oswald text-sm text-olf-beige shadow-sm"
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
									: 'bg-olf-darkgreen/20'}"
							></button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Trivia — a tilted "sticky note" -->
		<div
			class="mt-auto flex -rotate-1 items-start gap-2 self-center rounded-2xl border border-olf-yolk/40 bg-olf-yolk/20 px-4 py-3 shadow-sm"
		>
			<Sparkles size={16} class="mt-0.5 shrink-0 text-olf-yolk" />
			<p class="font-caveat text-lg leading-snug text-olf-darkbrown">Did you know? {trivia}</p>
		</div>
	</div>

	<!-- Delivery calendar — kept on green for legibility -->
	<div
		class="flex flex-col gap-3 rounded-[2rem] bg-olf-moss p-5 text-olf-beige shadow-sm lg:col-span-2"
	>
		<div class="flex flex-col items-center gap-0.5 text-center">
			<CalendarHeart size={22} class="text-olf-yolk" />
			<p class="font-oswald text-sm">{m.subscribe_since({ date: startedLabel })}</p>
			<p class="font-oswald text-xs tracking-widest uppercase opacity-80">
				{m.subscribe_delivery_every({ day: deliveryDayName })}
			</p>
		</div>
		<DeliveryCalendar
			deliveryDay={sub.deliveryDay}
			startedAt={sub.startedAt}
			cadenceWeeks={sub.plan.cadenceWeeks}
		/>
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
