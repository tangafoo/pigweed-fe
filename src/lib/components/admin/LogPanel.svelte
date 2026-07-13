<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import { TreePine, Timer } from '@lucide/svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { orderDateLabel } from '$lib/components/admin/shared.svelte';
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

	// ─── Countdown to the next automatic cron run ───────────────────
	let nowMs = $state(Date.now());
	onMount(() => {
		const tick = setInterval(() => (nowMs = Date.now()), 30_000);
		return () => clearInterval(tick);
	});
	const countdown = $derived.by(() => {
		if (!data?.nextCronRunAt) return '';
		const ms = new Date(data.nextCronRunAt).getTime() - nowMs;
		if (ms <= 60_000) return 'any minute now';
		const h = Math.floor(ms / 3_600_000);
		const m = Math.floor((ms % 3_600_000) / 60_000);
		return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
	});

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
	const PAGE_SIZES = [10, 25, 50, 100];
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

	function statusLabel(s: AdminSubscriptionDeliveryRow): string {
		if (s.recordedThisWeek && s.recordedAt) return `Logged ${orderDateLabel(s.recordedAt)}`;
		if (s.dueThisWeek) return `Due ${WEEKDAYS[s.deliveryDay]}`;
		return 'Not due this week';
	}
</script>

<section class="mt-8 flex flex-col gap-4">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div class="flex items-center gap-2">
			<TreePine size={22} class="text-olf-darkbrown" />
			<h2 class="font-homemade-apple text-2xl text-olf-darkbrown">Subscription log</h2>
		</div>
		{#if data?.weekStart}
			<span class="font-oswald text-sm text-olf-darkgreen/60"
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
				class="flex flex-col items-center gap-2 rounded-2xl bg-olf-darkgreen px-4 pt-5 pb-4 text-olf-eggshell"
			>
				<span class="font-supermercado-one text-xl tracking-wide">Record this week</span>

				<!-- Bezel housing + glow ring behind the button when it's armed. -->
				<div
					class="relative mt-1 rounded-full bg-olf-darkgreen p-2.5 shadow-[inset_0_3px_8px_rgba(0,0,0,0.55)] ring-2 ring-olf-eggshell/15"
				>
					{#if checked.size > 0 && !recording}
						<span
							class="absolute inset-0 animate-pulse rounded-full shadow-[0_0_28px_8px_rgba(210,60,40,0.45)]"
						></span>
					{/if}
					<Button
						disabled={recording || checked.size === 0}
						onclick={recordNow}
						aria-label="Record this week's subscription orders"
						class="relative flex size-36 cursor-pointer items-center justify-center rounded-full bg-olf-red bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.4),rgba(255,255,255,0)_62%)] font-supermercado-one text-4xl tracking-widest text-olf-eggshell uppercase shadow-[0_7px_0_0_rgba(0,0,0,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_9px_0_0_rgba(0,0,0,0.45)] active:translate-y-1.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.45)] disabled:translate-y-0 disabled:opacity-40 disabled:shadow-[0_4px_0_0_rgba(0,0,0,0.35)]"
					>
						LOG
					</Button>
				</div>

				<span class="font-oswald text-xs font-bold tracking-widest uppercase opacity-80">
					{#if checked.size > 0}
						{checked.size} subscriber{checked.size === 1 ? '' : 's'} armed
					{:else}
						nothing selected
					{/if}
				</span>
			</div>
			<p class="px-1 font-oswald text-xs leading-relaxed text-olf-darkgreen/70">
				Logs this week's egg order for every checked subscriber, at their tier's amount. Anyone
				already logged — by you or by the auto-run — is skipped, so it never double-records.
			</p>

			<div class="flex flex-col gap-3 rounded-2xl bg-olf-darkgreen px-4 py-4 text-olf-eggshell">
				<div class="flex items-center gap-3">
					<span
						class="flex size-9 shrink-0 items-center justify-center rounded-full bg-olf-lightgreen text-olf-darkgreen"
					>
						<Timer size={18} />
					</span>
					<span class="font-oswald text-sm font-bold">
						Auto-log runs {countdown || '…'}
					</span>
				</div>
				<span class="font-oswald text-xs opacity-75">
					The daily job records each subscriber on their delivery day — anyone you log here is
					skipped by it.
				</span>
			</div>
		</div>

		<!-- Right: subscribers table + pager -->
		<div class="flex min-w-0 flex-1 flex-col gap-4">
			<div class="overflow-x-auto rounded-2xl bg-olf-beige shadow">
				<div class="min-w-[38rem]">
					<div
						class="grid grid-cols-[2.5rem_minmax(9rem,1fr)_minmax(6rem,8rem)_4.5rem_4rem_minmax(9rem,11rem)] items-center gap-2 border-b border-olf-darkgreen/10 bg-olf-darkgreen/5 px-4 py-2.5 font-oswald text-xxs font-bold tracking-widest text-olf-darkgreen/50 uppercase"
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
									class="grid grid-cols-[2.5rem_minmax(9rem,1fr)_minmax(6rem,8rem)_4.5rem_4rem_minmax(9rem,11rem)] items-center gap-2 px-4 py-2 text-olf-darkgreen transition-colors hover:bg-olf-darkgreen/5"
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
									<span class="truncate font-oswald text-sm">
										{s.plan.name}
										{#if s.plan.cadenceWeeks > 1}
											<span class="text-olf-darkgreen/50">· every {s.plan.cadenceWeeks} wks</span>
										{/if}
									</span>
									<span class="text-center font-oswald text-sm"
										>{WEEKDAYS[s.deliveryDay]?.slice(0, 3) ?? '—'}</span
									>
									<span class="text-center font-oswald text-sm font-bold tabular-nums"
										>{s.plan.eggsPerDelivery}</span
									>
									<span
										class="font-oswald text-sm font-bold {s.recordedThisWeek
											? 'text-olf-moss'
											: s.dueThisWeek
												? 'text-olf-darkbrown'
												: 'text-olf-darkgreen/40'}"
									>
										{statusLabel(s)}
									</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Page-size + pager (same UX as the eggs ledger). -->
			{#if rows.length > PAGE_SIZES[0]}
				<div class="flex flex-wrap items-center justify-between gap-3">
					<label class="flex items-center gap-1.5 font-oswald text-xs text-olf-darkgreen/70">
						Show
						<select
							bind:value={pageSize}
							onchange={() => (clientPage = 1)}
							aria-label="Rows per page"
							class="cursor-pointer rounded-lg border border-olf-darkgreen/20 bg-white px-2 py-1.5 font-oswald text-sm text-olf-darkgreen"
						>
							{#each PAGE_SIZES as n (n)}<option value={n}>{n}</option>{/each}
						</select>
					</label>
					{#if rows.length > pageSize}
						<div class="flex items-center gap-4 font-oswald text-sm text-olf-darkgreen">
							<button
								type="button"
								disabled={clientPage <= 1}
								onclick={() => (clientPage -= 1)}
								class="underline disabled:opacity-40">← Prev</button
							>
							<span class="tabular-nums">Page {clientPage} of {clientPages}</span>
							<button
								type="button"
								disabled={clientPage >= clientPages}
								onclick={() => (clientPage += 1)}
								class="underline disabled:opacity-40">Next →</button
							>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</section>
