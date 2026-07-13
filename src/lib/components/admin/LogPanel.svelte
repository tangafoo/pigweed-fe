<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import { Pencil, X } from '@lucide/svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import OptionPicker from '$lib/components/ui/OptionPicker.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Pager from '$lib/components/admin/Pager.svelte';
	import { moneyRM, orderDateLabel, PAGE_SIZE_OPTIONS } from '$lib/components/admin/shared.svelte';
	import { toasts } from '$lib/realtime/toasts.svelte';
	import * as admin from '$lib/api/admin';
	import type {
		AdminSubscriptionDeliveriesResponse,
		AdminSubscriptionDeliveryRow
	} from '@meteorclass/pigweed-contract';

	// ─── The week's delivery sheet ──────────────────────────────────
	// One fetch owns the whole panel: every ACTIVE subscriber + whether this
	// farm-week's subscription order is due / already recorded (by the daily
	// cron OR a previous click here — same idempotency, so re-running is safe).
	let loading = $state(true);
	let data = $state<AdminSubscriptionDeliveriesResponse | null>(null);
	const checked = new SvelteSet<string>();

	async function load() {
		loading = true;
		const res = await admin.fetchSubscriptionDeliveries();
		data = res.ok ? res.data : null;
		loading = false;
		clientPage = 1;
		// Pre-check everyone who still needs logging this week.
		checked.clear();
		for (const s of data?.subscribers ?? []) {
			if (s.dueThisWeek && !s.recordedThisWeek) checked.add(s.userId);
		}
	}
	onMount(load);

	const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	// ─── Selection ──────────────────────────────────────────────────
	// Already-recorded rows can't be re-selected (recording them is a no-op
	// anyway); not-due rows CAN be checked but the BE skips them and says so.
	const selectable = $derived((data?.subscribers ?? []).filter((s) => !s.recordedThisWeek));
	const allChecked = $derived(
		selectable.length > 0 && selectable.every((s) => checked.has(s.userId))
	);
	function toggleAll() {
		if (allChecked) checked.clear();
		else for (const s of selectable) checked.add(s.userId);
	}

	// ─── Client-side paging (same pattern as the eggs ledger) ───────
	let pageSize = $state(10);
	let clientPage = $state(1);
	const rows = $derived(data?.subscribers ?? []);
	const clientPages = $derived(Math.max(1, Math.ceil(rows.length / pageSize)));
	const pagedRows = $derived(rows.slice((clientPage - 1) * pageSize, clientPage * pageSize));

	// ─── Record this week's orders for the checked subscribers ──────
	let recording = $state(false);
	async function recordNow() {
		if (recording || checked.size === 0) return;
		recording = true;
		const result = await admin.recordSubscriptionDeliveries([...checked]);
		recording = false;
		if (!result) {
			toasts.push({ title: 'Could not record — try again.' });
			return;
		}
		const skips: string[] = [];
		if (result.skippedRecorded) skips.push(`${result.skippedRecorded} already logged`);
		if (result.skippedNotDue) skips.push(`${result.skippedNotDue} not due this week`);
		toasts.push({
			title: `${result.fired} subscription order${result.fired === 1 ? '' : 's'} recorded 🥚`,
			subtitle: skips.join(' · ') || undefined
		});
		await load();
		await invalidateAll();
	}

	// Unlogged states only — a recorded week renders as the "logged" pill.
	function statusLabel(s: AdminSubscriptionDeliveryRow): string {
		if (s.dueThisWeek) return `Due ${WEEKDAYS[s.deliveryDay]}`;
		return 'Not due this week';
	}

	// ─── Per-subscriber pricing modal ────────────────────────────────
	// Tier = eggs + cadence; the PRICE is per subscriber (null = the farm
	// default RM2/egg). Changing it applies from the NEXT log — recorded
	// orders keep the price they were captured at.
	const DEFAULT_PRICE_CENTS = 200;
	let priceFor = $state<AdminSubscriptionDeliveryRow | null>(null);
	let priceStr = $state('');
	let priceSaving = $state(false);
	let priceError = $state('');
	let priceDialog = $state<HTMLDialogElement>();
	function openPrice(s: AdminSubscriptionDeliveryRow) {
		priceFor = s;
		priceStr = ((s.unitPriceCents ?? DEFAULT_PRICE_CENTS) / 100).toFixed(2);
		priceError = '';
	}
	$effect(() => {
		if (!priceDialog) return;
		if (priceFor && !priceDialog.open) priceDialog.showModal();
		else if (!priceFor && priceDialog.open) priceDialog.close();
	});
	const priceRM = $derived(parseFloat(priceStr));
	const priceCents = $derived(Number.isFinite(priceRM) ? Math.round(priceRM * 100) : 0);
	const priceWeeklyCents = $derived(priceFor ? priceCents * priceFor.plan.eggsPerDelivery : 0);
	// Save a custom price, or null to reset to the farm default.
	async function applyPrice(cents: number | null) {
		if (!priceFor || priceSaving) return;
		if (cents !== null && cents <= 0) {
			priceError = 'Price must be greater than 0.';
			return;
		}
		priceSaving = true;
		priceError = '';
		const ok = await admin.updateSubscriptionPrice(priceFor.userId, cents);
		priceSaving = false;
		if (!ok) {
			priceError = 'Could not save — try again.';
			return;
		}
		const name = priceFor.username;
		priceFor = null;
		toasts.push({
			title:
				cents === null ? `${name} is back on the default price.` : `${name}'s egg price updated!`
		});
		await load();
		await invalidateAll();
	}
</script>

<section class="mt-8 flex flex-col gap-4">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div class="flex items-center gap-2">
			<h2 class="font-homemade-apple text-2xl text-olf-darkbrown">Subscriptions</h2>
		</div>
		{#if data?.weekStart}
			<span class="font-oswald text-lg font-bold text-olf-darkgreen/70"
				>Week of {orderDateLabel(data.weekStart)}</span
			>
		{/if}
	</div>

	<!-- Two columns: the controls rail (timer + record button) on the left,
	     the subscribers table on the right. Stacks on small screens. -->
	<div class="flex flex-col gap-4 lg:flex-row lg:items-start">
		<!-- Left rail: the big shortcut first (the panel's whole point), then the
		     cron timer. Recording here and the nightly job share one rule — one
		     subscription order per subscriber per week — so neither ever
		     double-records. -->
		<div class="flex shrink-0 flex-col gap-3 lg:sticky lg:top-4 lg:w-64">
			<!-- The console: one big round button, laser-tag style. Title above,
			     armed-count below, the plain-words description under the housing. -->
			<div
				class="flex flex-col items-center gap-2 rounded-2xl bg-olf-darkgreen px-4 py-5 text-olf-eggshell shadow-xl"
			>
				<span class="text-center font-oswald font-light tracking-wide">
					Record {checked.size} subscriptions<br /> this week
				</span>

				<!-- Bezel housing + glow ring behind the button when it's armed. -->
				<div
					class="relative mt-1 rounded-full bg-olf-darkgreen p-2.5 shadow-[inset_0_3px_8px_rgba(0,0,0,0.55)] ring-2 ring-olf-eggshell/15"
				>
					{#if checked.size > 0 && !recording}
						<span
							class="absolute inset-0 animate-pulse rounded-full shadow-[0_0_28px_8px_rgba(204,214,127,0.5)]"
						></span>
					{/if}
					<Button
						disabled={recording || checked.size === 0}
						onclick={recordNow}
						aria-label="Record this week's subscription orders"
						class="relative flex size-36 cursor-pointer items-center justify-center rounded-full bg-olf-lightgreen bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.4),rgba(255,255,255,0)_62%)] font-oswald text-4xl font-bold tracking-widest text-olf-darkgreen uppercase shadow-[0_7px_0_0_rgba(0,0,0,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_9px_0_0_rgba(0,0,0,0.45)] active:translate-y-1.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.45)] disabled:translate-y-0 disabled:opacity-40 disabled:shadow-[0_4px_0_0_rgba(0,0,0,0.35)]"
					>
						LOG
					</Button>
				</div>

				<span class="font-oswald text-lg font-semibold tracking-widest uppercase opacity-80">
					{#if checked.size > 0}
						{checked.size} subscriber{checked.size === 1 ? '' : 's'} armed
					{:else}
						nothing selected
					{/if}
				</span>
			</div>
			<p class="px-1 font-oswald text-xs leading-relaxed text-olf-darkgreen/70">
				Override the auto-run.
			</p>
		</div>

		<!-- Right: subscribers table + pager -->
		<div class="flex min-w-0 flex-1 flex-col gap-4">
			<div class="overflow-x-auto rounded-2xl bg-olf-beige shadow">
				<div class="min-w-[44rem]">
					<div
						class="grid grid-cols-[2.5rem_minmax(9rem,1fr)_minmax(6rem,8rem)_4.5rem_4rem_5.5rem_minmax(9rem,11rem)] items-center gap-2 border-b border-olf-darkgreen/10 bg-olf-darkgreen/5 px-4 py-2.5 font-oswald text-xxs font-bold tracking-widest text-olf-darkgreen/50 uppercase"
					>
						<span class="flex justify-center">
							<input
								type="checkbox"
								checked={allChecked}
								disabled={selectable.length === 0}
								onchange={toggleAll}
								aria-label="Select all subscribers not yet logged"
								class="size-4 cursor-pointer rounded text-olf-darkbrown disabled:opacity-30"
							/>
						</span>
						<span>Subscriber</span>
						<span>Tier</span>
						<span class="text-center">Delivery</span>
						<span class="text-center">Eggs</span>
						<span class="text-center">Price</span>
						<span>This week</span>
					</div>

					{#if loading}
						<div class="flex justify-center py-8 text-olf-darkgreen/60"><Spinner /></div>
					{:else if !data}
						<p class="px-4 py-8 text-center font-oswald text-sm text-olf-darkgreen/60">
							Could not load subscribers — refresh to retry.
						</p>
					{:else if rows.length === 0}
						<p class="px-4 py-8 text-center font-oswald text-sm text-olf-darkgreen/60">
							No active subscribers yet.
						</p>
					{:else}
						<div class="divide-y divide-olf-darkgreen/10">
							{#each pagedRows as s (s.userId)}
								<div
									class="grid grid-cols-[2.5rem_minmax(9rem,1fr)_minmax(6rem,8rem)_4.5rem_4rem_5.5rem_minmax(9rem,11rem)] items-center gap-2 px-4 py-2 text-olf-darkgreen transition-colors hover:bg-olf-darkgreen/5"
								>
									<span class="flex justify-center">
										<input
											type="checkbox"
											checked={checked.has(s.userId)}
											disabled={s.recordedThisWeek}
											onchange={() => {
												if (checked.has(s.userId)) checked.delete(s.userId);
												else checked.add(s.userId);
											}}
											aria-label="Select {s.username}"
											class="size-4 cursor-pointer rounded text-olf-darkbrown disabled:opacity-30"
										/>
									</span>
									<a
										href="/users/{s.userId}"
										target="_blank"
										rel="noopener"
										class="flex min-w-0 items-center gap-2 hover:underline"
									>
										<Avatar
											animal={s.animal}
											avatarSeed={s.avatarSeed}
											gender={s.gender}
											size="sm"
										/>
										<span class="truncate font-oswald text-sm font-bold">{s.username}</span>
									</a>
									<span class="flex min-w-0 items-center gap-1.5 font-oswald text-sm">
										<span class="truncate">{s.plan.name}</span>
										{#if s.plan.cadenceWeeks > 1}
											<!-- Cadence flair — darkbrown pill so non-weekly subs jump out. -->
											<span
												class="shrink-0 rounded-full bg-olf-darkbrown px-2 py-0.5 font-oswald text-xxs font-bold tracking-wide text-olf-eggshell uppercase"
												>{s.plan.cadenceWeeks === 2
													? 'biweekly'
													: `every ${s.plan.cadenceWeeks} wks`}</span
											>
										{/if}
									</span>
									<span class="text-center font-oswald text-sm"
										>{WEEKDAYS[s.deliveryDay]?.slice(0, 3) ?? '—'}</span
									>
									<span class="text-center font-oswald text-sm font-bold tabular-nums"
										>{s.plan.eggsPerDelivery}</span
									>
									<!-- Per-subscriber price: custom = bold, default = faded. Click to change. -->
									<span class="flex justify-center">
										<button
											type="button"
											onclick={() => openPrice(s)}
											title={s.unitPriceCents == null
												? 'Farm default (RM2/egg) — click to set a custom price'
												: 'Custom price — click to change'}
											class="group flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-olf-darkgreen/10"
										>
											<span
												class="font-oswald text-sm tabular-nums {s.unitPriceCents == null
													? 'text-olf-darkgreen/50'
													: 'font-bold'}">{moneyRM(s.unitPriceCents ?? DEFAULT_PRICE_CENTS)}</span
											>
											<Pencil
												size={12}
												class="shrink-0 text-olf-darkgreen/40 group-hover:text-olf-darkgreen"
											/>
										</button>
									</span>
									<span class="flex flex-wrap items-center gap-1.5">
										{#if s.recordedThisWeek}
											<!-- Same pill language as the Users panel / eggs ledger. -->
											<span
												class="rounded-full bg-olf-moss px-2.5 py-1 font-oswald text-xs font-bold tracking-wide text-olf-eggshell uppercase"
												>logged</span
											>
											{#if s.recordedAt}
												<span class="font-oswald text-xs text-olf-darkgreen/60 tabular-nums"
													>{orderDateLabel(s.recordedAt)}</span
												>
											{/if}
										{:else}
											<span
												class="font-oswald text-sm font-medium {s.dueThisWeek
													? 'text-olf-darkbrown'
													: 'text-olf-darkgreen/40'}"
											>
												{statusLabel(s)}
											</span>
										{/if}
									</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Change sub pricing (per-subscriber; tier stays eggs + cadence). -->
			<dialog
				bind:this={priceDialog}
				onclose={() => (priceFor = null)}
				onclick={(e) => {
					if (e.target === priceDialog) priceFor = null;
				}}
				class="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
			>
				{#if priceFor}
					<div class="flex flex-col gap-4 p-6">
						<div class="flex items-start justify-between gap-4">
							<h2 class="font-homemade-apple text-xl">Change sub pricing</h2>
							<button
								type="button"
								aria-label="Close"
								onclick={() => (priceFor = null)}
								class="shrink-0 text-olf-darkgreen/60 hover:text-olf-darkgreen"
							>
								<X size={22} />
							</button>
						</div>

						<div class="flex items-center gap-2 font-oswald text-sm text-olf-darkgreen/70">
							<Avatar
								animal={priceFor.animal}
								avatarSeed={priceFor.avatarSeed}
								gender={priceFor.gender}
								size="sm"
							/>
							<span
								><b class="text-olf-darkgreen">{priceFor.username}</b> · {priceFor.plan.name}</span
							>
						</div>

						<label class="flex w-40 flex-col gap-1">
							<span
								class="font-oswald text-xs font-bold tracking-wide text-olf-darkgreen/70 uppercase"
								>Price / egg</span
							>
							<span class="flex items-center gap-1 font-oswald font-bold text-olf-darkgreen">
								RM
								<input
									type="text"
									inputmode="decimal"
									bind:value={priceStr}
									class="w-full min-w-0 rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-right tabular-nums"
								/>
							</span>
						</label>

						{#if priceWeeklyCents > 0}
							<!-- Pastel total bar — same treatment as the Order-eggs modal. -->
							<div
								class="flex items-center justify-between gap-3 rounded-xl bg-olf-lightgreen px-4 py-3 text-olf-darkgreen"
							>
								<span class="font-oswald text-xs tracking-wide uppercase opacity-80">
									{priceFor.plan.eggsPerDelivery} eggs × {moneyRM(priceCents)}
								</span>
								<span class="flex items-baseline gap-1">
									<span class="font-oswald text-xl font-bold tabular-nums"
										>{moneyRM(priceWeeklyCents)}</span
									>
									<span class="font-oswald text-xs opacity-70">/ delivery</span>
								</span>
							</div>
						{/if}

						<p class="font-oswald text-xs leading-relaxed text-olf-darkgreen/60">
							Applies from the next log, this week's included. Already-logged orders keep their
							price.
						</p>

						{#if priceError}
							<p class="rounded-lg bg-red-700 px-3 py-2 font-oswald text-xs text-white">
								{priceError}
							</p>
						{/if}

						<div class="flex flex-wrap items-center gap-2">
							<Button
								disabled={priceSaving}
								onclick={() => applyPrice(priceCents)}
								class="flex items-center gap-1.5 rounded-md bg-olf-darkgreen px-4 py-1.5 font-oswald text-xs font-bold text-white disabled:opacity-50"
							>
								Save
							</Button>
							{#if priceFor.unitPriceCents != null}
								<Button
									disabled={priceSaving}
									onclick={() => applyPrice(null)}
									class="rounded-md border-2 border-olf-darkgreen/30 px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen disabled:opacity-50"
								>
									Reset to default ({moneyRM(DEFAULT_PRICE_CENTS)})
								</Button>
							{/if}
							<Button
								disabled={priceSaving}
								onclick={() => (priceFor = null)}
								class="rounded-md px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen"
								>Cancel</Button
							>
						</div>
					</div>
				{/if}
			</dialog>

			<!-- Page-size + pager (same UX as the eggs ledger). -->
			{#if rows.length > PAGE_SIZE_OPTIONS[0].value}
				<div class="flex flex-wrap items-center justify-between gap-3">
					<label class="flex items-center gap-1.5 font-oswald text-xs text-olf-darkgreen/70">
						Show
						<OptionPicker
							options={PAGE_SIZE_OPTIONS}
							bind:value={pageSize}
							onchange={() => (clientPage = 1)}
							triggerClass="bg-white text-olf-darkgreen"
						/>
					</label>
					{#if rows.length > pageSize}
						<Pager bind:page={clientPage} pages={clientPages} />
					{/if}
				</div>
			{/if}
		</div>
	</div>
</section>
