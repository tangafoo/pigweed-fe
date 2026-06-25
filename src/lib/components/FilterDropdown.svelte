<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ChevronDown } from '@lucide/svelte';
	import { slide } from 'svelte/transition';

	interface FilterDropdownProps {
		// What the trigger shows for the current selection (text + aria fallback).
		label: string;
		// Optional rich trigger content (e.g. a gold star icon). Falls back to `label`.
		labelSnippet?: Snippet;
		// Trigger pill colour — lets a selected category tint its own trigger.
		triggerClass?: string;
		// The open panel's option rows. Receives `close` so a pick can dismiss it.
		children: Snippet<[() => void]>;
	}
	let {
		label,
		labelSnippet,
		triggerClass = 'bg-olf-beige text-olf-darkbrown',
		children
	}: FilterDropdownProps = $props();

	let open = $state(false);
	let root = $state<HTMLElement>();
	const close = () => (open = false);

	// Close on outside-click / Escape while open (matches LocaleSwitcher).
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
		onclick={() => (open = !open)}
		aria-haspopup="listbox"
		aria-expanded={open}
		class="flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 font-oswald text-sm font-bold transition-colors duration-200 {triggerClass}"
	>
		<span>{#if labelSnippet}{@render labelSnippet()}{:else}{label}{/if}</span>
		<ChevronDown size={14} class="shrink-0 transition-transform duration-200 {open ? 'rotate-180' : ''}" />
	</button>

	{#if open}
		<ul
			role="listbox"
			transition:slide={{ duration: 150 }}
			class="absolute left-0 z-50 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-olf-darkgreen/20 bg-olf-beige p-1 shadow-lg"
		>
			{@render children(close)}
		</ul>
	{/if}
</div>
