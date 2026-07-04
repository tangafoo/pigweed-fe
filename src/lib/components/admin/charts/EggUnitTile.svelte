<script lang="ts">
	import { RefreshCw } from '@lucide/svelte';
	import type { EggBox } from '@meteorclass/pigweed-contract';

	// A StatTile whose UNIT toggles on click: raw eggs → each active box
	// denomination (10 box / 15 box / Tray …) → back, dividing the egg count by
	// the box size. Mirrors the Home gauge's unit swapper. `boxes` is the EggBox
	// catalog; we use the active ones, smallest→largest. Falls back to a plain
	// (non-interactive) eggs tile when no boxes exist.
	let { eggs, boxes }: { eggs: number; boxes: EggBox[] } = $props();

	const activeBoxes = $derived([...boxes].filter((b) => b.active).sort((a, b) => a.eggs - b.eggs));
	let boxId = $state<string | null>(null); // null = raw eggs
	const box = $derived(activeBoxes.find((b) => b.id === boxId) ?? null);
	const value = $derived(box ? Math.floor(eggs / box.eggs) : eggs);
	const hint = $derived(
		box ? `${eggs.toLocaleString()} eggs · ${box.eggs}/box` : 'all-time · tap to switch'
	);

	// Cycle eggs → box denominations → back (same order as the gauge).
	function cycle() {
		if (activeBoxes.length === 0) return;
		const ids: (string | null)[] = [null, ...activeBoxes.map((b) => b.id)];
		boxId = ids[(ids.indexOf(boxId) + 1) % ids.length];
	}
</script>

<button
	type="button"
	onclick={cycle}
	disabled={activeBoxes.length === 0}
	title={activeBoxes.length ? 'Tap to switch unit (eggs / boxes)' : undefined}
	class="flex flex-col gap-0.5 rounded-xl bg-olf-beige px-3.5 py-3 text-left shadow-sm {activeBoxes.length
		? 'cursor-pointer transition-colors hover:bg-olf-eggshell'
		: ''}"
>
	<span
		class="flex items-center gap-1 font-oswald text-xxs tracking-wide text-olf-darkgreen/60 uppercase"
	>
		{box ? box.name : 'Eggs'}
		{#if activeBoxes.length}<RefreshCw size={9} class="shrink-0 opacity-50" />{/if}
	</span>
	<span class="font-oswald text-2xl leading-none font-bold text-olf-darkgreen tabular-nums"
		>{value.toLocaleString()}</span
	>
	<span class="mt-0.5 font-oswald text-xxs text-olf-darkgreen/45">{hint}</span>
</button>
