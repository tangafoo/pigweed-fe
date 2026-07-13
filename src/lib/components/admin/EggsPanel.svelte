<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { sineIn } from 'svelte/easing';
	import {
		Search,
		Plus,
		Trash2,
		Pencil,
		X,
		ChevronDown,
		ChevronUp,
		ChevronsUpDown,
		Download,
		RotateCcw
	} from '@lucide/svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import DatePicker from '$lib/components/ui/DatePicker.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import OptionPicker from '$lib/components/ui/OptionPicker.svelte';
	import EggOrderEntry from '$lib/components/admin/EggOrderEntry.svelte';
	import Pager from '$lib/components/admin/Pager.svelte';
	import UserPicker from '$lib/components/admin/UserPicker.svelte';
	import {
		isFutureDay,
		localYmd,
		moneyRM,
		orderDateLabel,
		PAGE_SIZE_OPTIONS
	} from '$lib/components/admin/shared.svelte';
	import { toasts } from '$lib/realtime/toasts.svelte';
	import * as admin from '$lib/api/admin';
	import type {
		AdminEggLedgerRow,
		AdminEggLedgerTotals,
		AdminUserRow
	} from '@meteorclass/pigweed-contract';
	import type { AdminBox } from '$lib/components/admin/shared.svelte';

	interface EggsPanelProps {
		users: AdminUserRow[];
		/** Box denominations for the add-order composer. */
		boxes: AdminBox[];
		/** Opens the shared AddUserModal (owned by the page). */
		onAddUser: () => void;
	}
	let { users, boxes, onAddUser }: EggsPanelProps = $props();

	// ─── Global egg ledger (accounting view) ────────────────────────
	// Loaded client-side on demand (not in the SvelteKit `load`); refetched
	// whenever a filter changes. The WHOLE filtered set is fetched (looping the
	// BE's 200-per-call cap) so sorting, week/month grouping, and the single
	// client-side pager all operate over every matching row — no second
	// server-page pager. The BE already scans the full filtered set for totals,
	// so this costs it nothing extra; revisit if the ledger ever hits ~5k rows.
	const LEDGER_FETCH_LIMIT = 200;
	const LEDGER_MAX_PAGES = 25;
	let ledgerRows = $state<AdminEggLedgerRow[]>([]);
	let ledgerTotals = $state<AdminEggLedgerTotals>({ eggs: 0, revenueCents: 0, orderCount: 0 });
	let ledgerLoading = $state(false);
	let ledgerFrom = $state('');
	let ledgerTo = $state('');
	let ledgerSource = $state<'' | 'MANUAL' | 'SUBSCRIPTION'>('');
	let ledgerQ = $state('');
	let ledgerShowDeleted = $state(false);
	let ledgerGroupBy = $state<'none' | 'week' | 'month'>('none');
	const SOURCE_OPTIONS = [
		{ value: '', label: 'All' },
		{ value: 'MANUAL', label: 'Manual' },
		{ value: 'SUBSCRIPTION', label: 'Subscription' }
	] as const;
	const GROUP_OPTIONS = [
		{ value: 'none', label: 'None' },
		{ value: 'week', label: 'Week' },
		{ value: 'month', label: 'Month' }
	] as const;
	// "Future" narrows to orders dated after today (the misclick-catcher —
	// matches the blue FUTURE row pill).
	const WHEN_OPTIONS = [
		{ value: '', label: 'All' },
		{ value: 'future', label: 'Future' }
	] as const;
	let ledgerWhen = $state<'' | 'future'>('');
	let ledgerSearchTimer: ReturnType<typeof setTimeout>;

	// Local tomorrow (Y-M-D) — the future filter's lower bound.
	const tomorrowYmd = () => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient "now", not reactive state
		const d = new Date();
		d.setDate(d.getDate() + 1);
		return localYmd(d.toISOString());
	};
	// Shared query params (row fetch + CSV export). The future filter rides the
	// existing `from` bound: from = max(picked From, tomorrow), so BE totals
	// stay correct.
	function ledgerParams() {
		const from =
			ledgerWhen === 'future'
				? [ledgerFrom, tomorrowYmd()].filter(Boolean).sort().at(-1)
				: ledgerFrom || undefined;
		return {
			from: from || undefined,
			to: ledgerTo || undefined,
			source: ledgerSource || undefined,
			q: ledgerQ || undefined,
			includeDeleted: ledgerShowDeleted
		};
	}

	// Monotonic token: a reload started while a previous multi-page fetch is
	// still in flight must win — stale batches are dropped, never rendered.
	let ledgerLoadSeq = 0;
	async function loadLedger() {
		const seq = ++ledgerLoadSeq;
		ledgerLoading = true;
		const params = { limit: LEDGER_FETCH_LIMIT, ...ledgerParams() };
		const rows: AdminEggLedgerRow[] = [];
		let page = 1;
		let res = await admin.fetchEggLedger({ ...params, page });
		rows.push(...res.data.rows);
		while (
			rows.length < res.data.total &&
			res.data.rows.length > 0 &&
			page < LEDGER_MAX_PAGES &&
			seq === ledgerLoadSeq
		) {
			page += 1;
			res = await admin.fetchEggLedger({ ...params, page });
			rows.push(...res.data.rows);
		}
		if (seq !== ledgerLoadSeq) return;
		ledgerRows = rows;
		ledgerTotals = res.data.totals;
		eggClientPage = 1;
		ledgerLoading = false;
	}
	// Reload from scratch (used by every filter control).
	function reloadLedger() {
		void loadLedger();
	}
	function ledgerSearchInput() {
		clearTimeout(ledgerSearchTimer);
		ledgerSearchTimer = setTimeout(reloadLedger, 250);
	}
	// One-click back to the default ledger view; the button only shows while
	// something is off-default.
	const filtersDirty = $derived(
		!!(
			ledgerFrom ||
			ledgerTo ||
			ledgerSource ||
			ledgerQ ||
			ledgerWhen ||
			ledgerShowDeleted ||
			ledgerGroupBy !== 'none'
		)
	);
	function clearFilters() {
		clearTimeout(ledgerSearchTimer);
		ledgerFrom = '';
		ledgerTo = '';
		ledgerSource = '';
		ledgerQ = '';
		ledgerWhen = '';
		ledgerShowDeleted = false;
		ledgerGroupBy = 'none';
		selectedMonth = null;
		reloadLedger();
	}
	// The panel only mounts when the Eggs view is opened — load right away.
	onMount(() => void loadLedger());

	async function softDeleteOrder(id: string) {
		if (await admin.deleteOrder(id)) {
			await loadLedger();
			await invalidateAll();
		}
	}
	async function restoreOrder(id: string) {
		if (await admin.restoreOrder(id)) {
			await loadLedger();
			await invalidateAll();
		}
	}
	let ledgerExporting = $state(false);
	async function exportLedger() {
		ledgerExporting = true;
		await admin.exportEggLedgerCsv(ledgerParams());
		ledgerExporting = false;
	}

	const lineTotal = (o: AdminEggLedgerRow) => o.eggs * o.unitPriceCents;
	const avgOrderEggs = $derived(
		ledgerTotals.orderCount ? Math.round(ledgerTotals.eggs / ledgerTotals.orderCount) : 0
	);
	// Click-to-sort the ledger by any column. Client-side over the whole
	// filtered set (all rows are loaded); clicking the active field flips direction.
	type LedgerSortField = 'date' | 'customer' | 'eggs' | 'boxes' | 'unit' | 'total';
	let ledgerSortField = $state<LedgerSortField>('date');
	let ledgerSortDir = $state<'asc' | 'desc'>('desc');
	function toggleLedgerSort(f: LedgerSortField) {
		if (ledgerSortField === f) ledgerSortDir = ledgerSortDir === 'asc' ? 'desc' : 'asc';
		else {
			ledgerSortField = f;
			ledgerSortDir = f === 'customer' ? 'asc' : 'desc';
		}
		eggClientPage = 1;
	}
	const sortValue = (o: AdminEggLedgerRow, f: LedgerSortField): number | string => {
		switch (f) {
			case 'customer':
				return o.username.toLowerCase();
			case 'eggs':
			case 'boxes':
				return o.eggs;
			case 'unit':
				return o.unitPriceCents;
			case 'total':
				return lineTotal(o);
			default:
				return +new Date(o.orderedAt);
		}
	};
	const sortedLedgerRows = $derived.by(() => {
		const dir = ledgerSortDir === 'asc' ? 1 : -1;
		return [...ledgerRows].sort((a, b) => {
			const av = sortValue(a, ledgerSortField);
			const bv = sortValue(b, ledgerSortField);
			return av < bv ? -dir : av > bv ? dir : 0;
		});
	});

	// ─── Month drill-down (Group by → Month) ────────────────────────
	// Month mode is a two-step view: first a picker of every month present in
	// the filtered set (as cards with subtotals), then the picked month's rows
	// as a normal table. `selectedMonth` holds the periodKey (e.g. "July 2026").
	let selectedMonth = $state<string | null>(null);
	type MonthCard = { key: string; orders: number; eggs: number; revenueCents: number };
	const monthCards = $derived.by<MonthCard[] | null>(() => {
		if (ledgerGroupBy !== 'month') return null;
		const cards: MonthCard[] = [];
		const index: Record<string, MonthCard> = {};
		for (const r of sortedLedgerRows) {
			const k = periodKey(r.orderedAt, 'month');
			let c = index[k];
			if (!c) {
				c = { key: k, orders: 0, eggs: 0, revenueCents: 0 };
				index[k] = c;
				cards.push(c);
			}
			// Subtotals skip soft-deleted rows (same rule as everywhere else).
			if (!r.deletedAt) {
				c.orders += 1;
				c.eggs += r.eggs;
				c.revenueCents += lineTotal(r);
			}
		}
		return cards;
	});
	// Falls back to the picker if the picked month vanished (filters changed).
	const activeMonth = $derived(
		selectedMonth && monthCards?.some((c) => c.key === selectedMonth) ? selectedMonth : null
	);
	const monthPickerShowing = $derived(!!monthCards && !activeMonth);
	function pickMonth(key: string | null) {
		selectedMonth = key;
		eggClientPage = 1;
	}

	// Client-side page-size (default 10) — the ONLY pager. It pages the visible
	// set: the picked month's rows in month mode, the whole filtered set
	// otherwise (the week view renders group headers around the paged rows).
	// The page resets explicitly wherever the row set or order changes:
	// loadLedger(), toggleLedgerSort(), pickMonth(), and the page-size select.
	let eggPageSize = $state(10);
	let eggClientPage = $state(1);
	const baseRows = $derived(
		activeMonth
			? sortedLedgerRows.filter((r) => periodKey(r.orderedAt, 'month') === activeMonth)
			: sortedLedgerRows
	);
	const eggClientPages = $derived(Math.max(1, Math.ceil(baseRows.length / eggPageSize)));
	const pagedLedgerRows = $derived(
		baseRows.slice((eggClientPage - 1) * eggPageSize, eggClientPage * eggPageSize)
	);

	// Delete-record confirmation (soft delete is recoverable, but confirm anyway).
	// The modal shell is the shared ConfirmDialog; this panel keeps its own
	// (admin-authority) delete action.
	let orderToDelete = $state<AdminEggLedgerRow | null>(null);
	async function confirmDeleteOrder() {
		if (!orderToDelete) return;
		const id = orderToDelete.id;
		orderToDelete = null;
		await softDeleteOrder(id);
	}

	// Edit a logged order — mainly the egg amount (a 60 that should've been 80),
	// with the unit price + date available too. Free-typed inputs (no steppers).
	let orderToEdit = $state<AdminEggLedgerRow | null>(null);
	let editEggsStr = $state('');
	let editPriceRMStr = $state('');
	let editDate = $state('');
	let editSaving = $state(false);
	let editError = $state('');
	let editDialog = $state<HTMLDialogElement>();

	function openEdit(o: AdminEggLedgerRow) {
		orderToEdit = o;
		editEggsStr = String(o.eggs);
		editPriceRMStr = (o.unitPriceCents / 100).toFixed(2);
		// Local calendar day, NOT orderedAt.slice(0, 10) — the UTC date can be one
		// day behind the date the row displays, and saving that back drifts the
		// order a day earlier on every edit.
		editDate = localYmd(o.orderedAt);
		editError = '';
	}
	$effect(() => {
		if (!editDialog) return;
		if (orderToEdit && !editDialog.open) editDialog.showModal();
		else if (!orderToEdit && editDialog.open) editDialog.close();
	});
	const editEggs = $derived(Math.round(parseFloat(editEggsStr)));
	const editPriceRM = $derived(parseFloat(editPriceRMStr));
	const editLineTotalCents = $derived(
		editEggs > 0 && editPriceRM > 0 ? Math.round(editEggs * editPriceRM * 100) : 0
	);
	async function saveEdit() {
		if (!orderToEdit || editSaving) return;
		if (!Number.isFinite(editEggs) || editEggs <= 0) {
			editError = 'Eggs must be greater than 0.';
			return;
		}
		editSaving = true;
		editError = '';
		const ok = await admin.updateOrder(orderToEdit.id, {
			eggs: editEggs,
			unitPriceCents:
				Number.isFinite(editPriceRM) && editPriceRM > 0 ? Math.round(editPriceRM * 100) : undefined,
			orderedAt: editDate ? new Date(editDate + 'T00:00:00').toISOString() : undefined
		});
		editSaving = false;
		if (!ok) {
			editError = 'Could not save — try again.';
			return;
		}
		orderToEdit = null;
		toasts.push({ title: 'Egg order updated!' });
		await loadLedger();
		await invalidateAll();
	}

	// Period grouping (week / month) with per-group subtotals — computed over
	// the whole filtered set. Subtotals exclude soft-deleted rows.
	function periodKey(iso: string, mode: 'week' | 'month'): string {
		const d = new Date(iso);
		if (mode === 'month')
			return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
		// Mon-start week on the LOCAL calendar (rows display local dates, so UTC
		// week math would file late-evening orders under the previous week).
		const day = d.getDay() || 7;
		const weekStartMs =
			new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
			(day - 1) * 24 * 60 * 60 * 1000;
		return `Week of ${new Date(weekStartMs).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
	}
	type LedgerGroup = { key: string; rows: AdminEggLedgerRow[]; eggs: number; revenueCents: number };
	// WEEK grouping only (month mode is the drill-down picker above). Pages
	// like the flat view: only the current page's rows render, but every group
	// header carries its FULL period subtotal (from the whole filtered set), so
	// a week straddling a page break still reads true. Plain object indexes
	// (not Maps) to satisfy svelte/prefer-svelte-reactivity; these are
	// transient computations, not reactive state.
	const ledgerGroups = $derived.by<LedgerGroup[] | null>(() => {
		if (ledgerGroupBy !== 'week') return null;
		const totals: Record<string, { eggs: number; revenueCents: number }> = {};
		for (const r of sortedLedgerRows) {
			const k = periodKey(r.orderedAt, ledgerGroupBy);
			const t = (totals[k] ??= { eggs: 0, revenueCents: 0 });
			if (!r.deletedAt) {
				t.eggs += r.eggs;
				t.revenueCents += lineTotal(r);
			}
		}
		const groups: LedgerGroup[] = [];
		const index: Record<string, LedgerGroup> = {};
		for (const r of pagedLedgerRows) {
			const k = periodKey(r.orderedAt, ledgerGroupBy);
			let g = index[k];
			if (!g) {
				const t = totals[k] ?? { eggs: 0, revenueCents: 0 };
				g = { key: k, rows: [], eggs: t.eggs, revenueCents: t.revenueCents };
				index[k] = g;
				groups.push(g);
			}
			g.rows.push(r);
		}
		return groups;
	});

	// ─── Add-egg-order modal (pick a customer, then log records) ────
	let addOrderOpen = $state(false);
	let addOrderUser = $state<AdminUserRow | null>(null);
	let addOrderDialog = $state<HTMLDialogElement>();
	$effect(() => {
		if (!addOrderDialog) return;
		if (addOrderOpen && !addOrderDialog.open) addOrderDialog.showModal();
		else if (!addOrderOpen && addOrderDialog.open) addOrderDialog.close();
	});
</script>

<section class="mt-8 flex flex-col gap-4">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 class="font-homemade-apple text-2xl text-olf-darkbrown">Eggs ledger</h2>
		<div class="flex flex-wrap items-center gap-2">
			<Button
				onclick={onAddUser}
				class="flex cursor-pointer items-center gap-1.5 rounded-md bg-olf-darkgreen px-3 py-1.5 font-oswald text-xs font-bold text-white"
			>
				<Plus size={14} /> Add user
			</Button>
			<Button
				onclick={exportLedger}
				disabled={ledgerExporting || ledgerTotals.orderCount === 0}
				class="flex cursor-pointer items-center gap-1.5 rounded-md border-2 border-olf-darkgreen px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen disabled:opacity-40"
			>
				<Download size={14} /> Export CSV
			</Button>
		</div>
	</div>

	<!-- Summary cards — reflect the ACTIVE filter (set a date range for a period statement). -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		{#each [{ label: 'Eggs', value: ledgerTotals.eggs.toLocaleString(), sub: `${(ledgerTotals.eggs / 30).toFixed(1)} boxes` }, { label: 'Revenue', value: moneyRM(ledgerTotals.revenueCents), sub: 'at recorded prices' }, { label: 'Orders', value: ledgerTotals.orderCount.toLocaleString(), sub: 'records' }, { label: 'Avg order', value: `${avgOrderEggs} 🥚`, sub: 'per record' }] as card (card.label)}
			<div class="flex flex-col rounded-2xl bg-olf-beige px-5 py-4 text-olf-darkgreen shadow">
				<span class="font-oswald text-xs tracking-wide uppercase opacity-70">{card.label}</span>
				{#if ledgerLoading}
					<span class="flex h-8 items-center text-olf-darkgreen/50"><Spinner size={18} /></span>
				{:else}
					<span class="font-caveat text-2xl leading-tight tabular-nums">{card.value}</span>
				{/if}
				<span class="font-oswald text-xxs text-olf-darkgreen/55">{card.sub}</span>
			</div>
		{/each}
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap items-end gap-3 rounded-2xl bg-olf-beige/60 p-4">
		<div class="flex flex-col gap-1">
			<span class="font-oswald text-xxs font-bold tracking-wide text-olf-darkgreen/60 uppercase"
				>From</span
			>
			<div class="w-40">
				<DatePicker bind:value={ledgerFrom} placeholder="Start" onchange={() => reloadLedger()} />
			</div>
		</div>
		<div class="flex flex-col gap-1">
			<span class="font-oswald text-xxs font-bold tracking-wide text-olf-darkgreen/60 uppercase"
				>To</span
			>
			<div class="w-40">
				<DatePicker bind:value={ledgerTo} placeholder="End" onchange={() => reloadLedger()} />
			</div>
		</div>
		<div class="flex flex-col gap-1">
			<span class="font-oswald text-xxs font-bold tracking-wide text-olf-darkgreen/60 uppercase"
				>Source</span
			>
			<OptionPicker
				options={SOURCE_OPTIONS}
				bind:value={ledgerSource}
				onchange={() => reloadLedger()}
				triggerClass="bg-white text-olf-darkgreen"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<span class="font-oswald text-xxs font-bold tracking-wide text-olf-darkgreen/60 uppercase"
				>Group by</span
			>
			<OptionPicker
				options={GROUP_OPTIONS}
				bind:value={ledgerGroupBy}
				onchange={() => pickMonth(null)}
				triggerClass="bg-white text-olf-darkgreen"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<span class="font-oswald text-xxs font-bold tracking-wide text-olf-darkgreen/60 uppercase"
				>When</span
			>
			<OptionPicker
				options={WHEN_OPTIONS}
				bind:value={ledgerWhen}
				onchange={() => reloadLedger()}
				triggerClass="bg-white text-olf-darkgreen"
			/>
		</div>
		<div class="relative flex-1 sm:flex-none">
			<Search
				size={16}
				class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-olf-darkgreen/50"
			/>
			<input
				bind:value={ledgerQ}
				oninput={ledgerSearchInput}
				placeholder="search customer"
				aria-label="Search customer"
				class="w-full rounded-lg border border-olf-darkgreen/20 bg-white py-1.5 pr-3 pl-8 font-oswald text-sm text-olf-darkgreen sm:w-56"
			/>
		</div>
		{#if filtersDirty}
			<!-- Sits right beside the search box; py matches the input height so it
			     centers on the same line. -->
			<button
				type="button"
				onclick={clearFilters}
				class="flex cursor-pointer items-center gap-1 self-end py-1.5 font-oswald text-sm font-bold text-olf-darkgreen/60 underline transition-colors hover:text-olf-darkgreen"
			>
				<X size={15} class="shrink-0" /> Clear
			</button>
		{/if}
		<Button
			onclick={() => {
				addOrderUser = null;
				addOrderOpen = true;
			}}
			class="ml-auto flex cursor-pointer items-center gap-1.5 rounded-md bg-olf-darkbrown px-3 py-1.5 font-oswald text-xs font-bold text-olf-eggshell"
		>
			<Plus size={14} /> Add egg order
		</Button>
	</div>

	<!-- Row snippet (shared by flat + grouped renders) -->
	{#snippet ledgerRowMarkup(o: AdminEggLedgerRow)}
		{@const dead = !!o.deletedAt}
		{@const future = isFutureDay(o.orderedAt)}
		<div
			class="grid grid-cols-[6.5rem_3.5rem_minmax(8rem,1fr)_4.5rem_3.5rem_5.5rem_4.5rem] items-center gap-2 px-4 py-2 text-olf-darkgreen transition-colors hover:bg-olf-darkgreen/5 {dead
				? 'opacity-50'
				: ''}"
		>
			<span class="font-oswald text-xs tabular-nums {dead ? 'line-through' : ''}">
				{orderDateLabel(o.orderedAt)}
			</span>
			<span class="font-oswald text-sm font-bold tabular-nums">{o.eggs}</span>
			<a
				href="/users/{o.userId}"
				target="_blank"
				rel="noopener"
				class="flex min-w-0 items-center gap-2 hover:underline"
			>
				<Avatar animal={o.animal} avatarSeed={o.avatarSeed} gender={o.gender} size="sm" />
				<span class="truncate font-oswald text-sm font-bold {dead ? 'line-through' : ''}"
					>{o.username}</span
				>
				{#if future}
					<!-- Dated after today — usually a date-picker month misclick. First
					     pill carries ml-auto; a subscription pill then sits beside it. -->
					<span
						title="Dated in the future — check the order date"
						class="ml-auto shrink-0 rounded-full bg-olf-blue px-2.5 py-1 font-oswald text-xs font-bold tracking-wide text-olf-eggshell uppercase"
					>
						future
					</span>
				{/if}
				{#if o.source === 'SUBSCRIPTION'}
					<!-- Manual rows stay unmarked (the default); only sub-fired rows get the
					     pill — same pill as the Users panel's "subscribed". -->
					<span
						title="Recorded by subscription"
						class="{future
							? ''
							: 'ml-auto'} shrink-0 rounded-full bg-olf-darkgreen px-2.5 py-1 font-oswald text-xs font-bold tracking-wide text-olf-eggshell uppercase"
					>
						subscription
					</span>
				{/if}
			</a>
			<span class="text-right font-oswald text-xs text-olf-darkgreen/70 tabular-nums"
				>{moneyRM(o.unitPriceCents)}</span
			>
			<span class="text-right font-oswald text-xs text-olf-darkgreen/60 tabular-nums"
				>{(o.eggs / 30).toFixed(1)}</span
			>
			<span class="text-right font-oswald text-sm font-bold text-olf-darkgreen tabular-nums"
				>{moneyRM(lineTotal(o))}</span
			>
			{#if dead}
				<div class="flex items-center justify-end">
					<button
						type="button"
						onclick={() => restoreOrder(o.id)}
						aria-label="Restore record"
						title="Restore"
						class="flex size-7 items-center justify-center rounded-md text-olf-blue hover:bg-olf-blue/10"
					>
						<RotateCcw size={14} />
					</button>
				</div>
			{:else}
				<div class="flex items-center justify-end gap-0.5">
					<button
						type="button"
						onclick={() => openEdit(o)}
						aria-label="Edit record"
						title="Edit"
						class="flex size-7 items-center justify-center rounded-md text-olf-darkgreen/50 hover:bg-olf-darkgreen/10 hover:text-olf-darkgreen"
					>
						<Pencil size={14} />
					</button>
					<button
						type="button"
						onclick={() => (orderToDelete = o)}
						aria-label="Delete record"
						title="Delete (recoverable)"
						class="flex size-7 items-center justify-center rounded-md text-olf-darkbrown/50 hover:bg-olf-darkbrown/10 hover:text-olf-darkbrown"
					>
						<Trash2 size={14} />
					</button>
				</div>
			{/if}
		</div>
	{/snippet}

	<!-- Ledger table -->
	<div class="overflow-x-auto rounded-2xl bg-olf-beige shadow">
		<div class="min-w-160">
			<!-- Column headers — click to sort the loaded page by that field. -->
			{#snippet sortTh(label: string, field: LedgerSortField, right = false)}
				<button
					type="button"
					onclick={() => toggleLedgerSort(field)}
					class="flex cursor-pointer items-center gap-0.5 tracking-widest uppercase transition-colors hover:text-olf-eggshell {right
						? 'justify-end'
						: ''} {ledgerSortField === field ? 'text-olf-eggshell' : ''}"
				>
					<span>{label}</span>
					{#if ledgerSortField === field}
						{#if ledgerSortDir === 'asc'}<ChevronUp size={12} class="shrink-0" />{:else}<ChevronDown
								size={12}
								class="shrink-0"
							/>{/if}
					{:else}
						<ChevronsUpDown size={12} class="shrink-0 opacity-40" />
					{/if}
				</button>
			{/snippet}
			{#if activeMonth}
				<!-- Drilled into one month: back to the picker on the left, the month's
				     totals front-and-center (the headline of this view). -->
				{@const card = monthCards?.find((c) => c.key === activeMonth)}
				<div
					class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-olf-darkgreen/10 bg-olf-darkgreen/8 px-4 py-2.5 font-oswald text-olf-darkgreen"
				>
					<button
						type="button"
						onclick={() => pickMonth(null)}
						class="cursor-pointer justify-self-start text-xs font-bold underline"
						>← All months</button
					>
					<span class="flex items-center gap-4 text-sm font-bold tabular-nums sm:text-base">
						<span>{activeMonth}</span>
						<span class="font-normal">{card?.orders ?? 0} orders · {card?.eggs ?? 0} 🥚</span>
						<span>{moneyRM(card?.revenueCents ?? 0)}</span>
					</span>
					<span></span>
				</div>
			{/if}
			{#if !monthPickerShowing}
				<div
					class="grid grid-cols-[6.5rem_3.5rem_minmax(8rem,1fr)_4.5rem_3.5rem_5.5rem_4.5rem] items-center gap-2 bg-olf-darkbrown px-4 py-2.5 font-oswald text-xxs font-bold tracking-widest text-olf-eggshell/70 uppercase"
				>
					{@render sortTh('Date', 'date')}
					{@render sortTh('Eggs', 'eggs')}
					{@render sortTh('Customer', 'customer')}
					{@render sortTh('Price', 'unit', true)}
					{@render sortTh('Boxes', 'boxes', true)}
					{@render sortTh('Total', 'total', true)}
					<span class="sr-only">Actions</span>
				</div>
			{/if}

			{#if ledgerLoading}
				<div class="flex justify-center py-8 text-olf-darkgreen/60"><Spinner /></div>
			{:else if ledgerRows.length === 0}
				<p class="px-4 py-8 text-center font-oswald text-sm text-olf-darkgreen/50">
					No egg records for this filter.
				</p>
			{:else if monthPickerShowing}
				<!-- Month mode, step 1: pick a month; the table shows after the pick. -->
				<div class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
					{#each monthCards ?? [] as c (c.key)}
						<button
							type="button"
							onclick={() => pickMonth(c.key)}
							class="flex cursor-pointer flex-col gap-0.5 rounded-xl bg-olf-darkgreen/5 px-4 py-3 text-left transition-colors hover:bg-olf-darkgreen/15"
						>
							<span class="font-oswald text-sm font-bold text-olf-darkgreen">{c.key}</span>
							<span class="font-oswald text-xs text-olf-darkgreen/70 tabular-nums"
								>{c.orders} orders · {c.eggs} 🥚</span
							>
							<span class="font-caveat text-3xl text-olf-darkgreen tabular-nums"
								>{moneyRM(c.revenueCents)}</span
							>
						</button>
					{/each}
				</div>
			{:else if ledgerGroups}
				{#each ledgerGroups as g (g.key)}
					<div
						class="flex items-center justify-between gap-3 bg-olf-darkgreen/8 px-4 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen"
					>
						<span>{g.key}</span>
						<span class="tabular-nums">{g.eggs} 🥚 · {moneyRM(g.revenueCents)}</span>
					</div>
					<div class="divide-y divide-olf-darkgreen/10">
						{#each g.rows as o (o.id)}{@render ledgerRowMarkup(o)}{/each}
					</div>
				{/each}
			{:else}
				<div class="divide-y divide-olf-darkgreen/10">
					{#each pagedLedgerRows as o (o.id)}{@render ledgerRowMarkup(o)}{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Show-deleted toggle + rows-per-page (under the table) -->
	<div class="flex flex-wrap items-center gap-4">
		<label
			class="flex cursor-pointer items-center gap-1.5 font-oswald text-xs text-olf-darkgreen/70"
		>
			<input
				type="checkbox"
				bind:checked={ledgerShowDeleted}
				onchange={() => reloadLedger()}
				class="size-4 rounded text-olf-darkbrown"
			/>
			Show deleted records
		</label>
		{#if !monthPickerShowing}
			<label class="flex items-center gap-1.5 font-oswald text-xs text-olf-darkgreen/70">
				Show
				<OptionPicker
					options={PAGE_SIZE_OPTIONS}
					bind:value={eggPageSize}
					onchange={() => (eggClientPage = 1)}
					triggerClass="bg-white text-olf-darkgreen"
				/>
			</label>
		{/if}
	</div>

	<!-- The single pager — client-side over the visible set (flat, week-grouped,
	     or the drilled-down month). Hidden while the month picker is up. -->
	{#if !monthPickerShowing && baseRows.length > eggPageSize}
		<Pager bind:page={eggClientPage} pages={eggClientPages} />
	{/if}
</section>

<!-- Add egg order modal (pick a customer, then log records) -->
<dialog
	bind:this={addOrderDialog}
	onclose={() => (addOrderOpen = false)}
	onclick={(e) => {
		if (e.target === addOrderDialog) addOrderOpen = false;
	}}
	class="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
>
	<div class="flex flex-col gap-4 p-6">
		<div class="flex items-start justify-between gap-4">
			<h2 class="font-homemade-apple text-xl">Add egg order</h2>
			<button
				type="button"
				aria-label="Close"
				onclick={() => (addOrderOpen = false)}
				class="shrink-0 text-olf-darkgreen/60 hover:text-olf-darkgreen"
			>
				<X size={22} />
			</button>
		</div>

		<div
			class="flex flex-col gap-1 font-oswald text-xs font-bold tracking-wide text-olf-darkgreen/80 uppercase"
		>
			<span>Customer</span>
			<UserPicker bind:value={addOrderUser} {users} />
		</div>

		{#if addOrderUser}
			<div
				in:fade={{ duration: 150, easing: sineIn }}
				class="rounded-lg border border-olf-darkgreen/15 bg-olf-eggshell/60 p-3"
			>
				<EggOrderEntry
					userId={addOrderUser.id}
					{boxes}
					onsaved={async (count) => {
						addOrderOpen = false;
						toasts.push({
							title: count === 1 ? 'Egg order added!' : `${count} egg orders added!`
						});
						await loadLedger();
						await invalidateAll();
					}}
				/>
			</div>
		{:else}
			<p class="font-oswald text-sm text-olf-darkgreen/60">
				Pick a customer to start logging eggs.
			</p>
		{/if}
	</div>
</dialog>

<!-- Delete egg record confirmation (soft delete — recoverable). Shares the
     ConfirmDialog shell; the delete action itself stays admin-side. -->
<ConfirmDialog
	open={orderToDelete !== null}
	title="Are you sure you want to delete?"
	confirmLabel="Delete"
	cancelLabel="Cancel"
	danger
	onConfirm={confirmDeleteOrder}
	onCancel={() => (orderToDelete = null)}
>
	{#if orderToDelete}
		Delete the <b>🥚 {orderToDelete.eggs}</b> record for
		<b>{orderToDelete.username}</b> on {orderDateLabel(orderToDelete.orderedAt)}? You can restore it
		later from the deleted records.
	{/if}
</ConfirmDialog>

<!-- Edit egg record (amount / price / date). Amount is the primary edit —
     e.g. a subscription logged 60 that should have been 80 this week. -->
<dialog
	bind:this={editDialog}
	onclose={() => (orderToEdit = null)}
	onclick={(e) => {
		if (e.target === editDialog) orderToEdit = null;
	}}
	class="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
>
	{#if orderToEdit}
		<div class="flex flex-col gap-4 p-6">
			<div class="flex items-start justify-between gap-4">
				<h2 class="font-homemade-apple text-xl">Edit egg order</h2>
				<button
					type="button"
					aria-label="Close"
					onclick={() => (orderToEdit = null)}
					class="shrink-0 text-olf-darkgreen/60 hover:text-olf-darkgreen"
				>
					<X size={22} />
				</button>
			</div>

			<div class="flex items-center gap-2 font-oswald text-sm text-olf-darkgreen/70">
				<Avatar
					animal={orderToEdit.animal}
					avatarSeed={orderToEdit.avatarSeed}
					gender={orderToEdit.gender}
					size="sm"
				/>
				<span>
					<b class="text-olf-darkgreen">{orderToEdit.username}</b> · {orderDateLabel(
						orderToEdit.orderedAt
					)}
				</span>
				{#if orderToEdit.source === 'SUBSCRIPTION'}<span
						class="rounded bg-olf-darkgreen/10 px-1.5 py-0.5 text-xxs font-bold tracking-wide uppercase"
						>Subscription</span
					>{/if}
			</div>

			<div class="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
				<label class="flex min-w-0 flex-col gap-1">
					<span class="font-oswald text-xs font-bold tracking-wide text-olf-darkgreen/70 uppercase"
						>Eggs</span
					>
					<input
						type="text"
						inputmode="numeric"
						bind:value={editEggsStr}
						class="w-full rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 font-oswald text-sm text-olf-darkgreen tabular-nums"
					/>
				</label>

				<label class="flex min-w-0 flex-col gap-1">
					<span class="font-oswald text-xs font-bold tracking-wide text-olf-darkgreen/70 uppercase"
						>Price / egg</span
					>
					<span class="flex items-center gap-1 font-oswald font-bold text-olf-darkgreen">
						RM
						<input
							type="text"
							inputmode="decimal"
							bind:value={editPriceRMStr}
							class="w-full min-w-0 rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-right tabular-nums"
						/>
					</span>
				</label>

				<div class="flex min-w-0 flex-col gap-1">
					<span class="font-oswald text-xs font-bold tracking-wide text-olf-darkgreen/70 uppercase"
						>Date</span
					>
					<DatePicker bind:value={editDate} />
				</div>
			</div>

			{#if editLineTotalCents > 0}
				<p class="font-oswald text-sm text-olf-darkgreen/70">
					Line total: <b class="tabular-nums">{moneyRM(editLineTotalCents)}</b>
				</p>
			{/if}

			{#if editError}
				<p class="rounded-lg bg-red-700 px-3 py-2 font-oswald text-xs text-white">{editError}</p>
			{/if}

			<div class="flex items-center gap-2">
				<Button
					disabled={editSaving}
					onclick={saveEdit}
					class="flex items-center gap-1.5 rounded-md bg-olf-darkgreen px-4 py-1.5 font-oswald text-xs font-bold text-white disabled:opacity-50"
				>
					Save
				</Button>
				<Button
					disabled={editSaving}
					onclick={() => (orderToEdit = null)}
					class="rounded-md px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen"
					>Cancel</Button
				>
			</div>
		</div>
	{/if}
</dialog>
