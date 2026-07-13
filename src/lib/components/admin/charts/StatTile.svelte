<script lang="ts">
	import { TrendingUp, TrendingDown } from '@lucide/svelte';
	import { pctLabel } from '$lib/utils/analytics';

	// A single KPI: label + big value + optional signed delta vs a prior period.
	// `value` is pre-formatted (money/compact) by the caller. `delta` is a
	// fraction (0.08 = +8%); `goodUp` decides whether ↑ is coloured good or bad.
	let {
		label,
		value,
		delta = undefined,
		goodUp = true,
		hint,
		tone = 'beige'
	}: {
		label: string;
		value: string;
		delta?: number | null;
		goodUp?: boolean;
		hint?: string;
		/** Tile background — 'eggshell' when the tile sits on a beige card. */
		tone?: 'beige' | 'eggshell';
	} = $props();

	// Direction × whether-up-is-good → colour. Zero/undefined = neutral muted.
	const deltaTone = $derived(
		delta == null || Math.round(delta * 100) === 0
			? 'neutral'
			: delta > 0 === goodUp
				? 'good'
				: 'bad'
	);
</script>

<div
	class="flex flex-col gap-0.5 rounded-xl px-3.5 py-3 shadow-sm {tone === 'eggshell'
		? 'bg-olf-eggshell'
		: 'bg-olf-beige'}"
>
	<span class="font-oswald text-xxs tracking-wide text-olf-darkgreen/60 uppercase">{label}</span>
	<span class="font-oswald text-2xl leading-none font-bold text-olf-darkgreen">{value}</span>
	{#if delta !== undefined}
		<span
			class="mt-0.5 flex items-center gap-1 font-oswald text-xs font-bold tabular-nums {deltaTone ===
			'good'
				? 'text-olf-moss'
				: deltaTone === 'bad'
					? 'text-olf-red'
					: 'text-olf-darkgreen/45'}"
		>
			{#if deltaTone === 'good'}<TrendingUp
					size={12}
					class="shrink-0"
				/>{:else if deltaTone === 'bad'}<TrendingDown size={12} class="shrink-0" />{/if}
			{pctLabel(delta ?? null)}
			<span class="font-normal text-olf-darkgreen/40">{hint ?? 'vs prev'}</span>
		</span>
	{:else if hint}
		<span class="mt-0.5 font-oswald text-xxs text-olf-darkgreen/45">{hint}</span>
	{/if}
</div>
