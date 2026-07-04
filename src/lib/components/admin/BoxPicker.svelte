<script lang="ts">
	import { Package } from '@lucide/svelte';
	import type { AdminBox } from '$lib/components/admin/shared.svelte';

	// The tap-to-add box composer, shared by every egg-entry surface (the
	// EGG-O-MATIC calculator + the EggOrderEntry rows). Each chip ADDS its egg
	// count to the running order via `onadd` — the caller keeps a plain egg
	// integer as the source of truth, so odd counts (e.g. 35) stay typeable in
	// the number field beside it. Only active boxes show; inactive ones are
	// hidden here but still editable in the Boxes panel.
	//
	// `variant` themes the chips for the surface: 'light' on the beige forms,
	// 'dark' on the espresso calculator console.
	let {
		boxes,
		onadd,
		variant = 'light'
	}: {
		boxes: AdminBox[];
		onadd: (eggs: number) => void;
		variant?: 'light' | 'dark';
	} = $props();

	const active = $derived(boxes.filter((b) => b.active));
</script>

{#if active.length}
	<div class="flex flex-wrap items-center gap-1.5">
		{#each active as b (b.id)}
			<button
				type="button"
				onclick={() => onadd(b.eggs)}
				title={`Add ${b.name} (${b.eggs} eggs)`}
				class="flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 font-oswald text-sm font-bold tracking-wide transition-colors {variant ===
				'dark'
					? 'bg-olf-eggshell/10 text-olf-beige/85 hover:bg-olf-yolk hover:text-olf-darkgreen'
					: 'bg-olf-darkgreen/10 text-olf-darkgreen hover:bg-olf-darkgreen/20'}"
			>
				<Package size={14} class="shrink-0 opacity-70" />
				<span class="font-bold opacity-80">+</span>
				{b.name}
				<span class="opacity-60">· {b.eggs}</span>
			</button>
		{/each}
	</div>
{/if}
