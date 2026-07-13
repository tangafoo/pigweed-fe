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

	// The open panel is position:FIXED at the trigger's screen coords, not
	// absolute — fixed boxes ignore ancestor overflow, so the panel can never
	// be clipped by (or add scroll to) a <dialog> or any scroll container.
	// (z-index alone can't fix that: nothing stacks its way out of an
	// ancestor's overflow clip.) Flips upward when the viewport room below the
	// trigger can't fit the panel. Coords are computed once per open.
	const PANEL_ROOM = 260; // ≈ max-h-60 + margin
	let panelStyle = $state('');
	function toggle() {
		if (!open && root) {
			const r = root.getBoundingClientRect();
			const openUp = window.innerHeight - r.bottom < PANEL_ROOM && r.top > PANEL_ROOM;
			panelStyle =
				`position:fixed;left:${r.left}px;min-width:${Math.max(r.width, 176)}px;` +
				(openUp ? `bottom:${window.innerHeight - r.top + 4}px` : `top:${r.bottom + 4}px`);
		}
		open = !open;
	}

	// Close on outside-click / Escape while open (matches LocaleSwitcher).
	// Also close on any outside scroll or resize: the fixed panel would
	// otherwise drift away from its trigger.
	$effect(() => {
		if (!open) return;
		const onClick = (e: MouseEvent) => {
			if (root && !root.contains(e.target as Node)) open = false;
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') open = false;
		};
		const onScroll = (e: Event) => {
			// Scrolling the option list itself shouldn't dismiss it.
			if (root && e.target instanceof Node && root.contains(e.target)) return;
			open = false;
		};
		document.addEventListener('click', onClick);
		document.addEventListener('keydown', onKey);
		window.addEventListener('scroll', onScroll, true);
		window.addEventListener('resize', onScroll);
		return () => {
			document.removeEventListener('click', onClick);
			document.removeEventListener('keydown', onKey);
			window.removeEventListener('scroll', onScroll, true);
			window.removeEventListener('resize', onScroll);
		};
	});
</script>

<div class="relative" bind:this={root}>
	<button
		type="button"
		onclick={toggle}
		aria-haspopup="listbox"
		aria-expanded={open}
		class="flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 font-oswald text-sm font-bold transition-colors duration-200 {triggerClass}"
	>
		<span
			>{#if labelSnippet}{@render labelSnippet()}{:else}{label}{/if}</span
		>
		<ChevronDown
			size={14}
			class="shrink-0 transition-transform duration-200 {open ? 'rotate-180' : ''}"
		/>
	</button>

	{#if open}
		<ul
			role="listbox"
			transition:slide={{ duration: 150 }}
			style={panelStyle}
			class="z-50 max-h-60 overflow-y-auto rounded-xl border border-olf-darkgreen/20 bg-olf-beige p-1 shadow-lg"
		>
			{@render children(close)}
		</ul>
	{/if}
</div>
