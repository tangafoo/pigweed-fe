<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import TierCard from '$lib/components/TierCard.svelte';
	import RollingNumber from '$lib/components/RollingNumber.svelte';
	import DeliveryCalendar from '$lib/components/DeliveryCalendar.svelte';
	import { Egg, Drumstick, CalendarDays, Clock } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const sub = $derived(data.subscription);
	const stats = $derived(data.stats);
	const currentPlanId = $derived(sub?.plan.id ?? null);

	// Fun facts derived from total eggs enjoyed. Playful, not clinical:
	//  • ~6 g protein per egg
	//  • a hen lays ~280 eggs/year → "hen-years" of laying
	const eggs = $derived(stats?.totalEggs ?? 0);
	const proteinG = $derived(eggs * 6);
	const henYears = $derived(Math.round((eggs / 280) * 10) / 10);

	// Delivery calendar bits. "since" + weekday name localized via the browser.
	const PHONE = '60172332992';
	const startedLabel = $derived(
		sub ? new Date(sub.startedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : ''
	);
	const deliveryDayName = $derived(
		sub ? new Date(2024, 0, 7 + sub.deliveryDay).toLocaleDateString(undefined, { weekday: 'long' }) : ''
	);
	const requestDayUrl = $derived(
		`https://wa.me/${PHONE}?text=${encodeURIComponent(m.subscribe_request_day_message())}`
	);

	const statusLabel = $derived(
		sub?.status === 'ACTIVE'
			? m.subscribe_status_active()
			: sub?.status === 'PAUSED'
				? m.subscribe_status_paused()
				: m.subscribe_status_canceled()
	);
	const statusClass = $derived(
		sub?.status === 'ACTIVE'
			? 'bg-olf-moss text-white'
			: sub?.status === 'PAUSED'
				? 'bg-olf-yolk text-olf-darkgreen'
				: 'bg-olf-darkbrown/70 text-olf-beige'
	);
</script>

<svelte:head>
	<title>{m.subscribe_page_title()} · Our Little Farm</title>
	<meta name="description" content={m.subscribe_page_lead()} />
</svelte:head>

<section class="flex flex-1 flex-col gap-10 bg-olf-beige px-5 py-12 text-olf-darkgreen">
	<header class="mx-auto flex max-w-3xl flex-col gap-3 text-center">
		<h1 class="font-homemade-apple text-4xl font-bold tracking-wide">{m.subscribe_page_title()}</h1>
		<p class="font-oswald text-lg opacity-80">{m.subscribe_page_lead()}</p>
	</header>

	<!-- Your subscription + egg journey (signed-in subscribers only) -->
	{#if sub && stats}
		<div class="mx-auto w-full max-w-3xl rounded-2xl bg-olf-darkgreen px-6 py-7 text-olf-beige shadow-md">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="flex flex-col">
					<span class="font-oswald text-xs uppercase tracking-widest opacity-70">
						{m.subscribe_your_plan()}
					</span>
					<span class="font-supermercado-one text-2xl">{sub.plan.name}</span>
				</div>
				<span class="rounded-full px-3 py-1 font-oswald text-xs font-bold uppercase tracking-wider {statusClass}">
					{statusLabel}
				</span>
			</div>

			<div class="mt-6 flex flex-col items-center gap-1 text-center">
				<Egg size={28} class="text-olf-yolk" />
				<span class="font-homemade-apple text-5xl font-bold tabular-nums text-olf-yolk">
					<RollingNumber text={String(eggs)} />
				</span>
				<span class="font-oswald text-sm uppercase tracking-widest opacity-80">
					{m.subscribe_stats_eggs_label()}
				</span>
			</div>

			<div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
				<div class="flex items-center gap-3 rounded-xl bg-olf-beige/10 px-4 py-3">
					<Drumstick size={20} class="shrink-0 text-olf-yolk" />
					<span class="font-oswald text-sm">{m.subscribe_stats_protein({ grams: proteinG })}</span>
				</div>
				<div class="flex items-center gap-3 rounded-xl bg-olf-beige/10 px-4 py-3">
					<Clock size={20} class="shrink-0 text-olf-yolk" />
					<span class="font-oswald text-sm">{m.subscribe_stats_henyears({ years: henYears })}</span>
				</div>
				<div class="flex items-center gap-3 rounded-xl bg-olf-beige/10 px-4 py-3">
					<CalendarDays size={20} class="shrink-0 text-olf-yolk" />
					<span class="font-oswald text-sm">{m.subscribe_stats_weeks({ count: stats.weeksActive })}</span>
				</div>
			</div>

			<div class="mt-6 flex flex-col gap-2">
				<p class="text-center font-oswald text-sm opacity-80">{m.subscribe_since({ date: startedLabel })}</p>
				<p class="text-center font-oswald text-xs uppercase tracking-widest opacity-60">
					{m.subscribe_delivery_every({ day: deliveryDayName })}
				</p>
				<DeliveryCalendar deliveryDay={sub.deliveryDay} />
				<a
					href={requestDayUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="text-center font-oswald text-xs underline opacity-70 hover:opacity-100"
				>
					{m.subscribe_request_day()}
				</a>
			</div>
		</div>
	{/if}

	<!-- Tiers -->
	<div class="mx-auto w-full max-w-5xl">
		<h2 class="mb-5 text-center font-supermercado-one text-2xl">
			{sub ? m.subscribe_change_tier_heading() : m.subscribe_choose_tier_heading()}
		</h2>
		{#if data.plans.length === 0}
			<p class="text-center font-oswald opacity-70">{m.subscribe_empty()}</p>
		{:else}
			<div class="grid gap-5 md:grid-cols-3">
				{#each data.plans as plan (plan.id)}
					<TierCard {plan} current={plan.id === currentPlanId} />
				{/each}
			</div>
		{/if}
		<p class="mt-5 text-center font-oswald text-xs uppercase tracking-wide opacity-60">
			{m.subscribe_manual_note()}
		</p>
	</div>
</section>
