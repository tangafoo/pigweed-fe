<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { sineIn } from 'svelte/easing';
	import {
		Search,
		Plus,
		Trash2,
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
	import EggOrderEntry from '$lib/components/admin/EggOrderEntry.svelte';
	import UserPicker from '$lib/components/admin/UserPicker.svelte';
	import { moneyRM, orderDateLabel, SORT_SELECT } from '$lib/components/admin/shared.svelte';
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
	// whenever a filter changes. Totals come from the BE over the WHOLE filtered
	// set, so they're correct even when the rows are paginated.
	const LEDGER_LIMIT = 100;
	let ledgerRows = $state<AdminEggLedgerRow[]>([]);
	let ledgerTotals = $state<AdminEggLedgerTotals>({ eggs: 0, revenueCents: 0, orderCount: 0 });
	let ledgerTotal = $state(0);
	let ledgerLoading = $state(false);
	let ledgerPage = $state(1);
	let ledgerFrom = $state('');
	let ledgerTo = $state('');
	let ledgerSource = $state(''); // '' | 'MANUAL' | 'SUBSCRIPTION'
	let ledgerQ = $state('');
	let ledgerShowDeleted = $state(false);
	let ledgerGroupBy = $state<'none' | 'week' | 'month'>('none');
	let ledgerSearchTimer: ReturnType<typeof setTimeout>;

	async function loadLedger() {
		ledgerLoading = true;
		const res = await admin.fetchEggLedger({
			page: ledgerPage,
			limit: LEDGER_LIMIT,
			from: ledgerFrom || undefined,
			to: ledgerTo || undefined,
			source: ledgerSource || undefined,
			q: ledgerQ || undefined,
			includeDeleted: ledgerShowDeleted
		});
		ledgerRows = res.data.rows;
		ledgerTotals = res.data.totals;
		ledgerTotal = res.data.total;
		ledgerLoading = false;
	}
	// Reset to page 1 and reload (used by every filter control).
	function reloadLedger() {
		ledgerPage = 1;
		void loadLedger();
	}
	function ledgerSearchInput() {
		clearTimeout(ledgerSearchTimer);
		ledgerSearchTimer = setTimeout(reloadLedger, 250);
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
		await admin.exportEggLedgerCsv({
			from: ledgerFrom || undefined,
			to: ledgerTo || undefined,
			source: ledgerSource || undefined,
			q: ledgerQ || undefined,
			includeDeleted: ledgerShowDeleted
		});
		ledgerExporting = false;
	}

	const lineTotal = (o: AdminEggLedgerRow) => o.eggs * o.unitPriceCents;
	const avgOrderEggs = $derived(
		ledgerTotals.orderCount ? Math.round(ledgerTotals.eggs / ledgerTotals.orderCount) : 0
	);
	const ledgerPages = $derived(Math.max(1, Math.ceil(ledgerTotal / LEDGER_LIMIT)));

	// Click-to-sort the loaded ledger page by any column. Client-side over the
	// loaded rows (the page is small); clicking the active field flips direction.
	type LedgerSortField = 'date' | 'customer' | 'eggs' | 'boxes' | 'unit' | 'total';
	let ledgerSortField = $state<LedgerSortField>('date');
	let ledgerSortDir = $state<'asc' | 'desc'>('desc');
	function toggleLedgerSort(f: LedgerSortField) {
		if (ledgerSortField === f) ledgerSortDir = ledgerSortDir === 'asc' ? 'desc' : 'asc';
		else {
			ledgerSortField = f;
			ledgerSortDir = f === 'customer' ? 'asc' : 'desc';
		}
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

	// Period grouping (week / month) with per-group subtotals — computed over the
	// loaded page. Subtotals exclude soft-deleted rows.
	function periodKey(iso: string, mode: 'week' | 'month'): string {
		const d = new Date(iso);
		if (mode === 'month')
			return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
		// Mon-start ISO week, computed by timestamp math (no mutable Date).
		const day = d.getUTCDay() || 7;
		const weekStartMs =
			Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
			(day - 1) * 24 * 60 * 60 * 1000;
		return `Week of ${new Date(weekStartMs).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
	}
	type LedgerGroup = { key: string; rows: AdminEggLedgerRow[]; eggs: number; revenueCents: number };
	const ledgerGroups = $derived.by<LedgerGroup[] | null>(() => {
		if (ledgerGroupBy === 'none') return null;
		// Plain object index (not a Map) to satisfy svelte/prefer-svelte-reactivity;
		// this is a transient computation, not reactive state.
		const groups: LedgerGroup[] = [];
		const index: Record<string, LedgerGroup> = {};
		for (const r of sortedLedgerRows) {
			const k = periodKey(r.orderedAt, ledgerGroupBy);
			let g = index[k];
			if (!g) {
				g = { key: k, rows: [], eggs: 0, revenueCents: 0 };
				index[k] = g;
				groups.push(g);
			}
			g.rows.push(r);
			if (!r.deletedAt) {
				g.eggs += r.eggs;
				g.revenueCents += lineTotal(r);
			}
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
			<select bind:value={ledgerSource} onchange={() => reloadLedger()} class={SORT_SELECT}>
				<option value="">All</option>
				<option value="MANUAL">Manual</option>
				<option value="SUBSCRIPTION">Subscription</option>
			</select>
		</div>
		<div class="flex flex-col gap-1">
			<span class="font-oswald text-xxs font-bold tracking-wide text-olf-darkgreen/60 uppercase"
				>Group by</span
			>
			<select bind:value={ledgerGroupBy} class={SORT_SELECT}>
				<option value="none">None</option>
				<option value="week">Week</option>
				<option value="month">Month</option>
			</select>
		</div>
		<div class="relative flex-1">
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
		<Button
			onclick={() => {
				addOrderUser = null;
				addOrderOpen = true;
			}}
			class="flex cursor-pointer items-center gap-1.5 rounded-md bg-olf-darkbrown px-3 py-1.5 font-oswald text-xs font-bold text-olf-eggshell"
		>
			<Plus size={14} /> Add egg order
		</Button>
	</div>

	<!-- Row snippet (shared by flat + grouped renders) -->
	{#snippet ledgerRowMarkup(o: AdminEggLedgerRow)}
		{@const dead = !!o.deletedAt}
		<div
			class="grid grid-cols-[6.5rem_3.5rem_minmax(8rem,1fr)_4.5rem_3.5rem_5.5rem_2.5rem] items-center gap-2 px-4 py-2 text-olf-darkgreen transition-colors hover:bg-olf-darkgreen/5 {dead
				? 'opacity-50'
				: ''}"
		>
			<span class="font-oswald text-xs tabular-nums {dead ? 'line-through' : ''}"
				>{orderDateLabel(o.orderedAt)}</span
			>
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
				<button
					type="button"
					onclick={() => restoreOrder(o.id)}
					aria-label="Restore record"
					title="Restore"
					class="flex size-7 items-center justify-center rounded-md text-olf-blue hover:bg-olf-blue/10"
				>
					<RotateCcw size={14} />
				</button>
			{:else}
				<button
					type="button"
					onclick={() => (orderToDelete = o)}
					aria-label="Delete record"
					title="Delete (recoverable)"
					class="flex size-7 items-center justify-center rounded-md text-olf-darkbrown/50 hover:bg-olf-darkbrown/10 hover:text-olf-darkbrown"
				>
					<Trash2 size={14} />
				</button>
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
					class="flex cursor-pointer items-center gap-0.5 tracking-widest uppercase transition-colors hover:text-olf-darkgreen {right
						? 'justify-end'
						: ''} {ledgerSortField === field ? 'text-olf-darkgreen' : ''}"
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
			<div
				class="grid grid-cols-[6.5rem_3.5rem_minmax(8rem,1fr)_4.5rem_3.5rem_5.5rem_2.5rem] items-center gap-2 border-b border-olf-darkgreen/10 bg-olf-darkgreen/5 px-4 py-2.5 font-oswald text-xxs font-bold tracking-widest text-olf-darkgreen/50 uppercase"
			>
				{@render sortTh('Date', 'date')}
				{@render sortTh('Eggs', 'eggs')}
				{@render sortTh('Customer', 'customer')}
				{@render sortTh('Price', 'unit', true)}
				{@render sortTh('Boxes', 'boxes', true)}
				{@render sortTh('Total', 'total', true)}
				<span class="sr-only">Actions</span>
			</div>

			{#if ledgerLoading}
				<div class="flex justify-center py-8 text-olf-darkgreen/60"><Spinner /></div>
			{:else if ledgerRows.length === 0}
				<p class="px-4 py-8 text-center font-oswald text-sm text-olf-darkgreen/50">
					No egg records for this filter.
				</p>
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
					{#each sortedLedgerRows as o (o.id)}{@render ledgerRowMarkup(o)}{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Show-deleted toggle (under the table — affects what the ledger lists) -->
	<label
		class="flex cursor-pointer items-center gap-1.5 self-start font-oswald text-xs text-olf-darkgreen/70"
	>
		<input
			type="checkbox"
			bind:checked={ledgerShowDeleted}
			onchange={() => reloadLedger()}
			class="size-4 rounded text-olf-darkbrown"
		/>
		Show deleted records
	</label>

	{#if ledgerTotal > LEDGER_LIMIT}
		<div class="flex items-center justify-center gap-4 font-oswald text-sm text-olf-darkgreen">
			<button
				type="button"
				disabled={ledgerPage <= 1}
				onclick={() => {
					ledgerPage -= 1;
					void loadLedger();
				}}
				class="underline disabled:opacity-40">← Prev</button
			>
			<span>Page {ledgerPage} of {ledgerPages}</span>
			<button
				type="button"
				disabled={ledgerPage >= ledgerPages}
				onclick={() => {
					ledgerPage += 1;
					void loadLedger();
				}}
				class="underline disabled:opacity-40">Next →</button
			>
		</div>
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
