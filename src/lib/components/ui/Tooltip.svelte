<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Small label that fades in under (or over) whatever it wraps, on hover
	 * and keyboard focus: a dark green pill. Visual only (aria-hidden), so the
	 * wrapped element needs its own accessible name (aria-label etc.).
	 * Uses the named group `group/tip`, so it nests inside other `group`s.
	 */
	let {
		text,
		children,
		placement = 'bottom',
		mono = false,
		class: cls = ''
	}: {
		text: string;
		children: Snippet;
		placement?: 'bottom' | 'top';
		/** font-mono text-xs instead of the surrounding font at text-sm. */
		mono?: boolean;
		/** Extra classes for the wrapper (e.g. layout). */
		class?: string;
	} = $props();
</script>

<span class="group/tip relative inline-flex {cls}">
	{@render children()}
	<span
		aria-hidden="true"
		class="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 rounded-lg bg-olf-darkgreen px-2 py-0.5 whitespace-nowrap text-olf-eggshell normal-case not-italic opacity-0 shadow-md transition-opacity duration-200 group-hover/tip:opacity-100 group-has-focus-visible/tip:opacity-100 {placement ===
		'top'
			? 'bottom-full mb-1.5'
			: 'top-full mt-1.5'} {mono ? 'font-mono text-xs' : 'text-sm'}"
	>
		{text}
	</span>
</span>
