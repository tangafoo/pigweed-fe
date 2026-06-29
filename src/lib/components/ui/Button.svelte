<script lang="ts">
	import type { Snippet } from 'svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';

	interface ButtonProps {
		children: Snippet;
		onclick?: (e: MouseEvent) => unknown;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		/** Force the loading state externally (otherwise it's inferred). */
		loading?: boolean;
		class?: string;
		spinnerSize?: number;
		title?: string;
		'aria-label'?: string;
	}

	let {
		children,
		onclick,
		type = 'button',
		disabled = false,
		loading = false,
		class: klass = '',
		spinnerSize = 14,
		title,
		'aria-label': ariaLabel
	}: ButtonProps = $props();

	// If the onclick handler returns a promise, the button shows a spinner and
	// disables itself until it settles — so every async action gets a loading
	// state for free, no external flag to thread through.
	let pending = $state(false);
	const isLoading = $derived(loading || pending);

	async function handle(e: MouseEvent) {
		const result = onclick?.(e);
		if (result instanceof Promise) {
			pending = true;
			try {
				await result;
			} finally {
				pending = false;
			}
		}
	}
</script>

<button
	{type}
	{title}
	aria-label={ariaLabel}
	disabled={disabled || isLoading}
	onclick={handle}
	class={klass}
>
	{#if isLoading}<Spinner size={spinnerSize} label="Loading" />{/if}
	{@render children()}
</button>
