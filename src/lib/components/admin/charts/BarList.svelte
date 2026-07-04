<script lang="ts">
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import type { Animal, Gender } from '@meteorclass/pigweed-contract';

	// Horizontal bar leaderboard (magnitude → single hue). Each row: identity +
	// a bar scaled to the max, value at the tip. Rows are selectable (drives the
	// per-customer deep-dive). Div bars, not SVG — crisp + responsive for a list.
	export interface BarItem {
		id: string;
		label: string;
		value: number;
		sub?: string;
		animal?: Animal;
		avatarSeed?: number;
		gender?: Gender;
	}
	let {
		items,
		format,
		onselect,
		activeId
	}: {
		items: BarItem[];
		format: (n: number) => string;
		onselect?: (id: string) => void;
		activeId?: string | null;
	} = $props();

	const max = $derived(Math.max(1, ...items.map((i) => i.value)));
</script>

{#snippet body(it: BarItem, pct: number)}
	<div class="flex items-center gap-2">
		{#if it.animal && it.avatarSeed !== undefined && it.gender}
			<Avatar animal={it.animal} avatarSeed={it.avatarSeed} gender={it.gender} size="sm" />
		{/if}
		<span class="min-w-0 flex-1 truncate font-oswald text-sm font-bold text-olf-darkgreen"
			>{it.label}</span
		>
		<span class="shrink-0 font-oswald text-sm font-bold text-olf-darkgreen tabular-nums"
			>{format(it.value)}</span
		>
	</div>
	<div class="flex items-center gap-2">
		<div class="h-2 flex-1 overflow-hidden rounded-full bg-olf-darkgreen/10">
			<div
				class="h-full rounded-full bg-olf-moss transition-[width] duration-500"
				style="width: {pct}%"
			></div>
		</div>
		{#if it.sub}
			<span class="shrink-0 font-oswald text-xxs text-olf-darkgreen/55 tabular-nums">{it.sub}</span>
		{/if}
	</div>
{/snippet}

<ul class="flex flex-col gap-1">
	{#each items as it (it.id)}
		{@const pct = Math.round((it.value / max) * 100)}
		{@const active = it.id === activeId}
		{@const activeCls = active ? 'bg-olf-darkgreen/8 ring-1 ring-olf-moss/40' : ''}
		<li>
			{#if onselect}
				<button
					type="button"
					onclick={() => onselect(it.id)}
					class="flex w-full cursor-pointer flex-col gap-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-olf-darkgreen/5 {activeCls}"
				>
					{@render body(it, pct)}
				</button>
			{:else}
				<div class="flex w-full flex-col gap-1 rounded-lg px-2 py-1.5 {activeCls}">
					{@render body(it, pct)}
				</div>
			{/if}
		</li>
	{/each}
</ul>
