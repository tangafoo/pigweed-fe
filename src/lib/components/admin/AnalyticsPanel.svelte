<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { TrendingUp, Users, AlertTriangle, Trophy } from '@lucide/svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import StatTile from '$lib/components/admin/charts/StatTile.svelte';
	import TrendArea from '$lib/components/admin/charts/TrendArea.svelte';
	import BarList from '$lib/components/admin/charts/BarList.svelte';
	import Sparkline from '$lib/components/admin/charts/Sparkline.svelte';
	import SegmentBadge from '$lib/components/admin/charts/SegmentBadge.svelte';
	import { moneyRM } from '$lib/components/admin/shared.svelte';
	import {
		agoLabel,
		atRiskCustomers,
		cadenceDays,
		compactNumber,
		pctDelta,
		segmentOf
	} from '$lib/utils/analytics';
	import * as admin from '$lib/api/admin';
	import type { AdminAnalytics, EggOrder } from '@meteorclass/pigweed-contract';
	import type { BarItem } from '$lib/components/admin/charts/BarList.svelte';

	// The farm's first data dashboard: headline KPIs, a revenue/eggs/orders
	// trend, top customers, an at-risk (retention) list, and a per-customer
	// deep-dive. Loaded client-side on mount (like the eggs ledger) so the page
	// nav stays instant. All charts are the reusable primitives in charts/.
	let data = $state<AdminAnalytics | null>(null);
	let loading = $state(true);
	let error = $state(false);

	onMount(async () => {
		const res = await admin.fetchAdminAnalytics();
		if (res.ok) data = res.data;
		else error = true;
		loading = false;
	});

	// ─── Formatters ─────────────────────────────────────────────────
	const num = (n: number) => n.toLocaleString();
	const axisMoney = (cents: number) => `RM${compactNumber(Math.round(cents / 100))}`;
	const weekLabel = (iso: string) =>
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient formatting
		new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
	const monthLabel = (iso: string) =>
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient formatting
		new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

	// ─── Trend chart (metric toggle) ────────────────────────────────
	type Metric = 'revenue' | 'eggs' | 'orders';
	let metric = $state<Metric>('revenue');
	const METRICS: { id: Metric; label: string }[] = [
		{ id: 'revenue', label: 'Revenue' },
		{ id: 'eggs', label: 'Eggs' },
		{ id: 'orders', label: 'Orders' }
	];
	const trendPoints = $derived(
		(data?.weekly ?? []).map((w) => ({
			label: weekLabel(w.weekStart),
			value: metric === 'revenue' ? w.revenueCents : metric === 'eggs' ? w.eggs : w.orders
		}))
	);
	const trendFormat = $derived(metric === 'revenue' ? moneyRM : num);
	const trendAxis = $derived(metric === 'revenue' ? axisMoney : compactNumber);

	// ─── KPI row (last 30d vs prior 30d) ────────────────────────────
	const kpis = $derived.by(() => {
		if (!data) return [];
		const w = data.window;
		const aov = (rev: number, ord: number) => (ord > 0 ? rev / ord : 0);
		const perEgg = (rev: number, eggs: number) => (eggs > 0 ? rev / eggs : 0);
		return [
			{
				label: `Revenue · ${w.days}d`,
				value: moneyRM(w.revenueCents),
				delta: pctDelta(w.revenueCents, w.prevRevenueCents)
			},
			{ label: `Eggs · ${w.days}d`, value: num(w.eggs), delta: pctDelta(w.eggs, w.prevEggs) },
			{
				label: `Orders · ${w.days}d`,
				value: num(w.orders),
				delta: pctDelta(w.orders, w.prevOrders)
			},
			{
				label: `Active · ${w.days}d`,
				value: num(w.activeCustomers),
				delta: pctDelta(w.activeCustomers, w.prevActiveCustomers)
			},
			{
				label: 'Avg order',
				value: moneyRM(aov(w.revenueCents, w.orders)),
				delta: pctDelta(aov(w.revenueCents, w.orders), aov(w.prevRevenueCents, w.prevOrders))
			},
			{
				label: 'Price / egg',
				value: moneyRM(perEgg(w.revenueCents, w.eggs)),
				delta: pctDelta(perEgg(w.revenueCents, w.eggs), perEgg(w.prevRevenueCents, w.prevEggs))
			}
		];
	});

	// ─── Top customers + at-risk ────────────────────────────────────
	const topCustomers = $derived.by<BarItem[]>(() => {
		if (!data) return [];
		return [...data.customers]
			.sort((a, b) => b.revenueCents - a.revenueCents)
			.slice(0, 7)
			.map((c) => ({
				id: c.id,
				label: c.username,
				value: c.revenueCents,
				sub: `${c.orders} order${c.orders === 1 ? '' : 's'}`,
				animal: c.animal,
				avatarSeed: c.avatarSeed,
				gender: c.gender
			}));
	});
	const atRisk = $derived(data ? atRiskCustomers(data.customers) : []);

	// ─── Per-customer deep-dive ─────────────────────────────────────
	let selectedId = $state<string | null>(null);
	let custOrders = $state<EggOrder[] | null>(null);
	let custLoadingId = $state<string | null>(null);
	const selected = $derived(data?.customers.find((c) => c.id === selectedId) ?? null);
	const selectedSegment = $derived(selected ? segmentOf(selected) : null);
	// Their order history, oldest→newest, as per-order revenue — the sparkline.
	const sparkValues = $derived(
		custOrders
			? [...custOrders]
					.sort((a, b) => new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime())
					.map((o) => o.eggs * o.unitPriceCents)
			: []
	);

	async function selectCustomer(id: string | null) {
		selectedId = id;
		custOrders = null;
		if (!id) return;
		custLoadingId = id;
		const orders = await admin.fetchOrders(id);
		if (selectedId === id) custOrders = orders;
		custLoadingId = null;
	}

	// Everyone with orders, alphabetical — the deep-dive picker.
	const pickList = $derived(
		[...(data?.customers ?? [])].sort((a, b) => a.username.localeCompare(b.username))
	);
</script>

<section class="mt-10 flex flex-col gap-5">
	<div class="flex items-center gap-2">
		<TrendingUp size={20} class="text-olf-darkgreen" />
		<h2 class="font-homemade-apple text-2xl text-olf-darkbrown">Farm analytics</h2>
	</div>

	{#if loading}
		<div class="flex justify-center py-16 text-olf-darkgreen/50"><Spinner /></div>
	{:else if error || !data}
		<p
			class="rounded-2xl bg-olf-beige px-4 py-8 text-center font-oswald text-sm text-olf-darkgreen/60"
		>
			Couldn't load analytics. Try refreshing.
		</p>
	{:else if data.totals.orders === 0}
		<p
			class="rounded-2xl bg-olf-beige px-4 py-8 text-center font-oswald text-sm text-olf-darkgreen/60"
		>
			No egg orders logged yet — once you record some, the charts light up here. 🥚
		</p>
	{:else}
		<!-- KPI row -->
		<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
			{#each kpis as k (k.label)}
				<StatTile label={k.label} value={k.value} delta={k.delta} />
			{/each}
		</div>

		<!-- Trend -->
		<div class="rounded-2xl bg-olf-beige p-4 shadow-sm">
			<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
				<h3 class="font-oswald text-sm font-bold tracking-wide text-olf-darkgreen/80 uppercase">
					Over time · weekly
				</h3>
				<div
					class="flex gap-1 rounded-full bg-olf-darkgreen/10 p-0.5 font-oswald text-xs font-bold"
				>
					{#each METRICS as m (m.id)}
						<button
							type="button"
							onclick={() => (metric = m.id)}
							aria-pressed={metric === m.id}
							class="cursor-pointer rounded-full px-3 py-1 transition-colors {metric === m.id
								? 'bg-olf-darkgreen text-olf-eggshell'
								: 'text-olf-darkgreen/70 hover:bg-olf-darkgreen/10'}"
						>
							{m.label}
						</button>
					{/each}
				</div>
			</div>
			<TrendArea points={trendPoints} format={trendFormat} axisFormat={trendAxis} />
		</div>

		<!-- Top customers + at-risk (items-start so the shorter card doesn't stretch) -->
		<div class="grid gap-4 lg:grid-cols-2 lg:items-start">
			<div class="rounded-2xl bg-olf-beige p-4 shadow-sm">
				<h3
					class="mb-3 flex items-center gap-1.5 font-oswald text-sm font-bold tracking-wide text-olf-darkgreen/80 uppercase"
				>
					<Trophy size={15} class="text-olf-yolk" /> Top customers · lifetime spend
				</h3>
				<BarList
					items={topCustomers}
					format={moneyRM}
					onselect={selectCustomer}
					activeId={selectedId}
				/>
			</div>

			<div class="rounded-2xl bg-olf-beige p-4 shadow-sm">
				<h3
					class="mb-3 flex items-center gap-1.5 font-oswald text-sm font-bold tracking-wide text-olf-darkgreen/80 uppercase"
				>
					<AlertTriangle size={15} class="text-olf-yolk" /> At-risk · going quiet
				</h3>
				{#if atRisk.length === 0}
					<p
						class="rounded-xl bg-olf-darkgreen/5 px-4 py-6 text-center font-oswald text-sm text-olf-darkgreen/55"
					>
						No regulars have gone quiet — nice. 🌱
					</p>
				{:else}
					<ul class="flex flex-col gap-1">
						{#each atRisk.slice(0, 7) as c (c.id)}
							<li>
								<button
									type="button"
									onclick={() => selectCustomer(c.id)}
									class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-olf-darkgreen/5 {selectedId ===
									c.id
										? 'bg-olf-darkgreen/8 ring-1 ring-olf-yolk/40'
										: ''}"
								>
									<Avatar animal={c.animal} avatarSeed={c.avatarSeed} gender={c.gender} size="sm" />
									<span
										class="min-w-0 flex-1 truncate font-oswald text-sm font-bold text-olf-darkgreen"
										>{c.username}</span
									>
									<span class="shrink-0 font-oswald text-xs font-bold text-olf-yolk tabular-nums"
										>{agoLabel(c.lastOrderAt)}</span
									>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>

		<!-- Per-customer deep-dive -->
		<div class="rounded-2xl bg-olf-beige p-4 shadow-sm">
			<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
				<h3
					class="flex items-center gap-1.5 font-oswald text-sm font-bold tracking-wide text-olf-darkgreen/80 uppercase"
				>
					<Users size={15} class="text-olf-moss" /> Customer deep-dive
				</h3>
				<select
					value={selectedId ?? ''}
					onchange={(e) => selectCustomer(e.currentTarget.value || null)}
					class="cursor-pointer rounded-lg border border-olf-darkgreen/20 bg-white px-2 py-1 font-oswald text-xs text-olf-darkgreen"
				>
					<option value="">Pick a customer…</option>
					{#each pickList as c (c.id)}
						<option value={c.id}>{c.username}</option>
					{/each}
				</select>
			</div>

			{#if selected && selectedSegment}
				{@const cad = cadenceDays(selected)}
				<div in:fade={{ duration: 150 }} class="flex flex-col gap-4">
					<div class="flex flex-wrap items-center gap-3">
						<Avatar
							animal={selected.animal}
							avatarSeed={selected.avatarSeed}
							gender={selected.gender}
							size="md"
						/>
						<div class="min-w-0">
							<div class="flex items-center gap-2">
								<span class="font-supermercado-one text-lg text-olf-darkbrown"
									>{selected.username}</span
								>
								<SegmentBadge segment={selectedSegment} size="md" />
							</div>
							<span class="font-oswald text-xs text-olf-darkgreen/60"
								>Customer since {monthLabel(selected.firstOrderAt)}</span
							>
						</div>
						<div class="ml-auto">
							{#if custLoadingId === selected.id}
								<Spinner size={16} />
							{:else if sparkValues.length}
								<Sparkline values={sparkValues} />
							{/if}
						</div>
					</div>

					<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
						<StatTile label="Lifetime" value={moneyRM(selected.revenueCents)} hint="revenue" />
						<StatTile label="Eggs" value={num(selected.eggs)} hint="all-time" />
						<StatTile label="Orders" value={num(selected.orders)} hint="all-time" />
						<StatTile
							label="Avg order"
							value={moneyRM(selected.orders ? selected.revenueCents / selected.orders : 0)}
							hint="per order"
						/>
						<StatTile label="Cadence" value={cad ? `~${cad}d` : '—'} hint="between orders" />
						<StatTile
							label="Last order"
							value={agoLabel(selected.lastOrderAt)}
							hint={selectedSegment.blurb}
						/>
					</div>
				</div>
			{:else}
				<p
					class="rounded-xl bg-olf-darkgreen/5 px-4 py-6 text-center font-oswald text-sm text-olf-darkgreen/55"
				>
					Pick a customer above — or tap one in the charts — to see their story.
				</p>
			{/if}
		</div>
	{/if}
</section>
