<script lang="ts">
	import { Plus, X, RefreshCw, RotateCcw } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import Button from '$lib/components/ui/Button.svelte';
	import DatePicker from '$lib/components/ui/DatePicker.svelte';
	import BoxPicker from '$lib/components/admin/BoxPicker.svelte';
	import type { AdminBox } from '$lib/components/admin/shared.svelte';
	import * as admin from '$lib/api/admin';

	// Reusable bulk egg-record entry: a list of draft rows (eggs + date) plus a
	// single unit price for the batch, saved all at once against `userId`. Used
	// in the user expand card, the Add-user modal, and the Eggs panel.
	// `boxes` feeds the tap-to-add composer above each row; it's optional so old
	// call-sites that don't thread it degrade to plain egg/RM entry.
	let {
		userId,
		boxes = [],
		onsaved
	}: { userId: string; boxes?: AdminBox[]; onsaved?: (count: number) => void } = $props();

	type OrderDraft = { eggs: number; date: string };
	let drafts = $state<OrderDraft[]>([{ eggs: 0, date: '' }]);
	// Row-input unit: eggs, or RM (reverse — type what the customer paid, get
	// eggs at the batch price). Boxes are composed via the BoxPicker chips
	// (admin denominations), so there's no ambiguous "1 box = 30" unit anymore.
	// Eggs stays the source of truth.
	type Unit = 'eggs' | 'rm';
	let unit = $state<Unit>('eggs');
	const UNIT_LABEL: Record<Unit, string> = { eggs: '🥚 Eggs', rm: '💵 RM' };
	const cycleUnit = () => (unit = unit === 'eggs' ? 'rm' : 'eggs');
	// Price per egg in RM (default RM2.00). Free-typed decimal string (no stepper);
	// `priceRM` is the parsed number applied to every row in the batch.
	let priceRMStr = $state('2.00');
	const priceRM = $derived(parseFloat(priceRMStr) || 0);
	let saving = $state(false);

	const validDrafts = $derived(drafts.filter((d) => d.eggs > 0).length);

	function reset() {
		drafts = [{ eggs: 0, date: '' }];
		unit = 'eggs';
	}
	// The row's displayed value in the current unit (eggs are canonical).
	function rowValue(d: OrderDraft): number {
		if (unit === 'rm') return d.eggs * priceRM;
		return d.eggs;
	}
	function setCount(i: number, v: number) {
		const n = Math.max(0, Number.isFinite(v) ? v : 0);
		drafts[i].eggs = unit === 'rm' ? (priceRM > 0 ? Math.floor(n / priceRM) : 0) : Math.round(n);
	}
	// A box chip adds its eggs to the row (compose an order from boxes).
	const addBox = (i: number, eggs: number) => (drafts[i].eggs += eggs);
	async function save() {
		if (saving || validDrafts === 0) return;
		saving = true;
		const unitPriceCents = Math.max(1, Math.round((priceRM || 0) * 100));
		const rows = drafts.filter((x) => x.eggs > 0);
		for (const d of rows) {
			await admin.recordOrder(userId, {
				eggs: d.eggs,
				unitPriceCents,
				orderedAt: d.date ? new Date(d.date).toISOString() : undefined
			});
		}
		saving = false;
		reset();
		onsaved?.(rows.length);
	}
</script>

<div class="flex flex-col gap-3">
	<span class="font-oswald text-xs font-bold tracking-wide text-olf-darkgreen/70 uppercase">
		Add egg records
	</span>

	<!-- Unit price (RM/egg) for the whole batch -->
	<label class="flex items-center gap-2 font-oswald text-xs text-olf-darkgreen/70">
		<span class="tracking-wide uppercase">Price / egg</span>
		<span class="flex items-center gap-1 font-bold text-olf-darkgreen">
			RM
			<input
				type="text"
				inputmode="decimal"
				bind:value={priceRMStr}
				placeholder="2.00"
				class="w-20 rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1 text-right tabular-nums"
			/>
		</span>
	</label>

	<!-- Column labels. The Eggs/Boxes label is itself the unit toggle. -->
	<div
		class="flex gap-2 font-oswald text-xxs font-bold tracking-wide text-olf-darkgreen/60 uppercase"
	>
		<button
			type="button"
			onclick={cycleUnit}
			title="Switch unit (eggs / boxes / RM)"
			class="inline-flex w-24 cursor-pointer items-center gap-1 text-olf-darkgreen hover:text-olf-moss"
		>
			{UNIT_LABEL[unit]}
			<RefreshCw size={10} class="shrink-0" />
		</button>
		<span>Date</span>
	</div>

	{#each drafts as d, i (i)}
		<div class="flex flex-col gap-1.5">
			<div class="flex flex-wrap items-center gap-2">
				<input
					type="text"
					inputmode="decimal"
					value={rowValue(d)}
					oninput={(e) => setCount(i, parseFloat(e.currentTarget.value))}
					class="w-24 rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 font-oswald text-sm text-olf-darkgreen tabular-nums"
				/>
				<div class="w-44">
					<DatePicker bind:value={d.date} placeholder="Today" />
				</div>
				{#if unit !== 'eggs'}
					<span class="font-oswald text-xxs text-olf-darkgreen/55">= {d.eggs} eggs</span>
				{/if}
				{#if d.eggs > 0}
					<span class="font-oswald text-xxs text-olf-darkgreen/55" transition:slide={{ axis: 'x' }}>
						RM{(d.eggs * Math.max(0, priceRM || 0) || 0).toLocaleString('en-MY', {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2
						})}
					</span>
				{/if}
				{#if drafts.length > 1}
					<button
						type="button"
						onclick={() => (drafts = drafts.filter((_, idx) => idx !== i))}
						aria-label="Remove row"
						class="flex size-8 items-center justify-center rounded-md text-olf-red hover:bg-olf-red/10"
					>
						<X size={16} />
					</button>
				{/if}
			</div>
			<!-- Tap-to-add box composer (admin denominations). Adds to the row; the
			     number field above stays free-typed for odd counts (e.g. 35). -->
			{#if boxes.length}
				<div class="flex flex-wrap items-center gap-1.5">
					<BoxPicker {boxes} onadd={(eggs) => addBox(i, eggs)} />
					{#if d.eggs > 0}
						<button
							type="button"
							onclick={() => (d.eggs = 0)}
							title="Clear this row"
							class="flex cursor-pointer items-center gap-1 font-oswald text-sm font-bold text-olf-darkgreen/50 hover:text-olf-darkbrown"
						>
							<RotateCcw size={13} class="shrink-0" /> clear
						</button>
					{/if}
				</div>
			{/if}
		</div>
	{/each}

	<div class="flex flex-wrap items-center gap-2">
		<button
			type="button"
			onclick={() => (drafts = [...drafts, { eggs: 0, date: '' }])}
			class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-olf-darkgreen/20 px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen hover:bg-olf-darkgreen/10"
		>
			<Plus size={14} /> Add more
		</button>
		<Button
			disabled={saving || validDrafts === 0}
			onclick={save}
			class="flex items-center gap-1.5 rounded-md bg-olf-darkbrown px-4 py-1.5 font-oswald text-xs font-bold text-olf-eggshell disabled:opacity-50"
		>
			Save {validDrafts} record{validDrafts === 1 ? '' : 's'}
		</Button>
	</div>
</div>
