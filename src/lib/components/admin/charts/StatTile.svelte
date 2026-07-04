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
		hint
	}: {
		label: string;
		value: string;
		delta?: number | null;
		goodUp?: boolean;
		hint?: string;
	} = $props();

	// Direction × whether-up-is-good → colour. Zero/undefined = neutral muted.
	const tone = $derived(
		delta == null || Math.round(delta * 100) === 0
			? 'neutral'
			: delta > 0 === goodUp
				? 'good'
				: 'bad'
	);
</script>

<div class="flex flex-col gap-0.5 rounded-xl bg-olf-beige px-3.5 py-3 shadow-sm">
	<span class="font-oswald text-xxs tracking-wide text-olf-darkgreen/60 uppercase">{label}</span>
	<span class="font-oswald text-2xl leading-none font-bold text-olf-darkgreen">{value}</span>
	{#if delta !== undefined}
		<span
			class="mt-0.5 flex items-center gap-1 font-oswald text-xs font-bold tabular-nums {tone ===
			'good'
				? 'text-olf-moss'
				: tone === 'bad'
					? 'text-olf-red'
					: 'text-olf-darkgreen/45'}"
		>
			{#if tone === 'good'}<TrendingUp
					size={12}
					class="shrink-0"
				/>{:else if tone === 'bad'}<TrendingDown size={12} class="shrink-0" />{/if}
			{pctLabel(delta ?? null)}
			<span class="font-normal text-olf-darkgreen/40">{hint ?? 'vs prev'}</span>
		</span>
	{:else if hint}
		<span class="mt-0.5 font-oswald text-xxs text-olf-darkgreen/45">{hint}</span>
	{/if}
</div>
