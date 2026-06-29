<script lang="ts">
	import { ChevronLeft, ChevronRight, CalendarDays } from '@lucide/svelte';
	import { slide } from 'svelte/transition';

	// Tiny, dependency-free date dropdown. `value` is an ISO date string
	// 'YYYY-MM-DD' (empty = none). Cute month-grid popover, click a day to pick.
	let {
		value = $bindable(''),
		placeholder = 'Pick a date',
		onchange,
		align = 'left'
	}: {
		value?: string;
		placeholder?: string;
		onchange?: (value: string) => void;
		/** Which edge the popover anchors to — use 'right' near the viewport edge. */
		align?: 'left' | 'right';
	} = $props();

	let open = $state(false);
	let root = $state<HTMLElement>();

	// The month being viewed — seeded from the value (or today) each time we open.
	function seed() {
		const d = value ? new Date(value + 'T00:00:00') : new Date();
		return { y: d.getFullYear(), m: d.getMonth() };
	}
	let view = $state(seed());
	function toggle() {
		if (!open) view = seed();
		open = !open;
	}

	const monthLabel = $derived(
		new Date(view.y, view.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
	);
	const headers = [0, 1, 2, 3, 4, 5, 6].map((d) =>
		new Date(2024, 0, 7 + d).toLocaleDateString(undefined, { weekday: 'narrow' })
	);
	const firstWeekday = $derived(new Date(view.y, view.m, 1).getDay());
	const daysInMonth = $derived(new Date(view.y, view.m + 1, 0).getDate());
	const cells = $derived([
		...Array(firstWeekday).fill(null),
		...Array.from({ length: daysInMonth }, (_, i) => i + 1)
	] as (number | null)[]);

	const pad = (n: number) => String(n).padStart(2, '0');
	const iso = (d: number) => `${view.y}-${pad(view.m + 1)}-${pad(d)}`;
	const label = $derived(
		value
			? new Date(value + 'T00:00:00').toLocaleDateString(undefined, {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				})
			: ''
	);

	function pick(d: number) {
		value = iso(d);
		open = false;
		onchange?.(value);
	}
	function clear() {
		value = '';
		open = false;
		onchange?.('');
	}
	const prev = () =>
		(view = view.m === 0 ? { y: view.y - 1, m: 11 } : { y: view.y, m: view.m - 1 });
	const next = () =>
		(view = view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 });

	// Close on outside-click / Escape (listeners attach only while open, after
	// the opening click has finished propagating — same pattern as LocaleSwitcher).
	$effect(() => {
		if (!open) return;
		const onClick = (e: MouseEvent) => {
			if (root && !root.contains(e.target as Node)) open = false;
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') open = false;
		};
		document.addEventListener('click', onClick);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('click', onClick);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<div class="relative" bind:this={root}>
	<button
		type="button"
		onclick={toggle}
		class="flex w-full items-center gap-2 rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-left font-oswald text-sm text-olf-darkgreen"
	>
		<CalendarDays size={15} class="shrink-0 opacity-60" />
		<span class={label ? '' : 'opacity-50'}>{label || placeholder}</span>
	</button>

	{#if open}
		<div
			transition:slide={{ duration: 120 }}
			class="absolute z-50 mt-1 w-64 rounded-xl border border-olf-darkgreen/15 bg-olf-beige p-3 text-olf-darkgreen shadow-xl {align ===
			'right'
				? 'right-0'
				: 'left-0'}"
		>
			<div class="mb-2 flex items-center justify-between">
				<button
					type="button"
					onclick={prev}
					aria-label="Previous month"
					class="flex size-7 items-center justify-center rounded-md hover:bg-olf-darkgreen/10"
				>
					<ChevronLeft size={16} />
				</button>
				<span class="font-oswald text-sm font-bold">{monthLabel}</span>
				<button
					type="button"
					onclick={next}
					aria-label="Next month"
					class="flex size-7 items-center justify-center rounded-md hover:bg-olf-darkgreen/10"
				>
					<ChevronRight size={16} />
				</button>
			</div>

			<div class="grid grid-cols-7 gap-0.5 text-center">
				{#each headers as h, i (i)}
					<span class="py-1 font-oswald text-xxs uppercase opacity-50">{h}</span>
				{/each}
				{#each cells as d, i (i)}
					{#if d === null}
						<span></span>
					{:else}
						<button
							type="button"
							onclick={() => pick(d)}
							class="aspect-square rounded-md font-oswald text-xs tabular-nums {value === iso(d)
								? 'bg-olf-darkgreen font-bold text-olf-beige'
								: 'hover:bg-olf-darkgreen/10'}"
						>
							{d}
						</button>
					{/if}
				{/each}
			</div>

			{#if value}
				<button
					type="button"
					onclick={clear}
					class="mt-2 w-full rounded-md py-1 font-oswald text-xs text-olf-darkbrown/70 hover:bg-olf-darkbrown/10"
				>
					Clear
				</button>
			{/if}
		</div>
	{/if}
</div>
