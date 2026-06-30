<script lang="ts">
	import { Plus, X, RefreshCw } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import Button from '$lib/components/ui/Button.svelte';
	import DatePicker from '$lib/components/ui/DatePicker.svelte';
	import * as admin from '$lib/api/admin';

	// Reusable bulk egg-record entry: a list of draft rows (eggs + date) plus a
	// single unit price for the batch, saved all at once against `userId`. Used
	// in the user expand card, the Add-user modal, and the Eggs panel.
	let { userId, onsaved }: { userId: string; onsaved?: (count: number) => void } = $props();

	const EGGS_PER_BOX = 30;
	const BOX_PRESETS = [2, 3, 4, 5];

	type OrderDraft = { eggs: number; date: string };
	let drafts = $state<OrderDraft[]>([{ eggs: 30, date: '' }]);
	let byBox = $state(false);
	// Price per egg in RM (default RM2.00). Free-typed decimal string (no stepper);
	// `priceRM` is the parsed number applied to every row in the batch.
	let priceRMStr = $state('2.00');
	const priceRM = $derived(parseFloat(priceRMStr) || 0);
	let saving = $state(false);

	const validDrafts = $derived(drafts.filter((d) => d.eggs > 0).length);

	function reset() {
		drafts = [{ eggs: 30, date: '' }];
		byBox = false;
	}
	function setCount(i: number, v: number) {
		const n = Math.max(0, Number.isFinite(v) ? v : 0);
		drafts[i].eggs = byBox ? Math.round(n * EGGS_PER_BOX) : Math.round(n);
	}
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
			onclick={() => (byBox = !byBox)}
			title={byBox ? 'Switch to eggs' : 'Switch to boxes'}
			class="inline-flex w-24 cursor-pointer items-center gap-1 text-olf-darkgreen hover:text-olf-moss"
		>
			{byBox ? '📦 Boxes' : '🥚 Eggs'}
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
					value={byBox ? d.eggs / EGGS_PER_BOX : d.eggs}
					oninput={(e) => setCount(i, parseFloat(e.currentTarget.value))}
					class="w-24 rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 font-oswald text-sm text-olf-darkgreen tabular-nums"
				/>
				<div class="w-44">
					<DatePicker bind:value={d.date} placeholder="Today" />
				</div>
				{#if byBox}
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
			<!-- Box-quantity hotkeys (1 box = 30 eggs) -->
			<div class="flex flex-wrap gap-1.5">
				{#each BOX_PRESETS as b (b)}
					<button
						type="button"
						onclick={() => (d.eggs = b * EGGS_PER_BOX)}
						class="cursor-pointer rounded-full px-2.5 py-1 font-oswald text-xxs font-bold tracking-wide transition-colors {d.eggs ===
						b * EGGS_PER_BOX
							? 'bg-olf-darkgreen text-olf-beige'
							: 'bg-olf-darkgreen/10 text-olf-darkgreen hover:bg-olf-darkgreen/20'}"
					>
						{b} box
					</button>
				{/each}
			</div>
		</div>
	{/each}

	<div class="flex flex-wrap items-center gap-2">
		<button
			type="button"
			onclick={() => (drafts = [...drafts, { eggs: 30, date: '' }])}
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
