<script lang="ts">
	import { ChevronsUpDown, Check } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import type { Animal, Gender } from '@meteorclass/pigweed-contract';

	// Custom customer picker — same popover mechanics as DatePicker (trigger
	// button + absolute list, close on outside-click / Escape, flip up when the
	// space below is tight). Rows carry the procedural avatar so the admin picks
	// by face, not just name. Scrolls past ~7 rows.
	type Option = {
		id: string;
		username: string;
		animal: Animal;
		avatarSeed: number;
		gender: Gender;
	};
	let {
		options,
		value = $bindable(null),
		placeholder = 'Pick a customer…',
		onchange
	}: {
		options: Option[];
		value?: string | null;
		placeholder?: string;
		onchange?: (id: string | null) => void;
	} = $props();

	let open = $state(false);
	let root = $state<HTMLElement>();
	let dropUp = $state(false);
	const selected = $derived(options.find((o) => o.id === value) ?? null);

	function toggle() {
		if (!open && root) {
			const r = root.getBoundingClientRect();
			const spaceBelow = window.innerHeight - r.bottom;
			// ~300px popover; flip up only if below is tight and above has more room.
			dropUp = spaceBelow < 300 && r.top > spaceBelow;
		}
		open = !open;
	}
	function pick(id: string | null) {
		value = id;
		open = false;
		onchange?.(id);
	}

	// Close on outside-click / Escape — listeners live only while open.
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
		aria-haspopup="listbox"
		aria-expanded={open}
		class="flex w-full items-center gap-2 rounded-lg border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-left font-oswald text-sm text-olf-darkgreen"
	>
		{#if selected}
			<Avatar
				animal={selected.animal}
				avatarSeed={selected.avatarSeed}
				gender={selected.gender}
				size="sm"
			/>
			<span class="min-w-0 flex-1 truncate font-bold">{selected.username}</span>
		{:else}
			<span class="min-w-0 flex-1 truncate opacity-50">{placeholder}</span>
		{/if}
		<ChevronsUpDown size={15} class="shrink-0 opacity-50" />
	</button>

	{#if open}
		<div
			transition:slide={{ duration: 120 }}
			role="listbox"
			class="absolute left-0 z-50 max-h-72 w-full overflow-y-auto rounded-xl border border-olf-darkgreen/15 bg-olf-beige p-1.5 shadow-xl {dropUp
				? 'bottom-full mb-1'
				: 'top-full mt-1'}"
		>
			{#if value}
				<button
					type="button"
					onclick={() => pick(null)}
					class="mb-1 w-full rounded-md px-2 py-1.5 text-left font-oswald text-xs text-olf-darkbrown/70 hover:bg-olf-darkbrown/10"
				>
					Clear selection
				</button>
			{/if}
			{#if options.length === 0}
				<p class="px-2 py-3 text-center font-oswald text-xs text-olf-darkgreen/50">
					No customers yet.
				</p>
			{:else}
				{#each options as o (o.id)}
					<button
						type="button"
						onclick={() => pick(o.id)}
						role="option"
						aria-selected={value === o.id}
						class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-olf-darkgreen/10 {value ===
						o.id
							? 'bg-olf-darkgreen/10'
							: ''}"
					>
						<Avatar animal={o.animal} avatarSeed={o.avatarSeed} gender={o.gender} size="sm" />
						<span class="min-w-0 flex-1 truncate font-oswald text-sm font-bold text-olf-darkgreen"
							>{o.username}</span
						>
						{#if value === o.id}<Check size={15} class="shrink-0 text-olf-moss" />{/if}
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>
