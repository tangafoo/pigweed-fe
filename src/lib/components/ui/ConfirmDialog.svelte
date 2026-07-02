<script lang="ts">
	import type { Snippet } from 'svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';

	/**
	 * Presentational confirm modal — a native <dialog> (free focus-trap + Esc)
	 * with a fade/scale transition. It owns NO data or authority: the caller
	 * passes the copy and the `onConfirm` action, so a user-side delete and an
	 * admin-side delete can share this shell without sharing their logic.
	 */
	interface ConfirmDialogProps {
		/** Two-way open state. */
		open: boolean;
		title: string;
		confirmLabel: string;
		cancelLabel: string;
		/** Red, destructive styling on the confirm button. */
		danger?: boolean;
		/** In-flight: shows a spinner and locks Esc/backdrop/buttons. */
		busy?: boolean;
		onConfirm: () => void;
		onCancel?: () => void;
		/** Optional body copy below the title. */
		children?: Snippet;
	}
	let {
		open = $bindable(),
		title,
		confirmLabel,
		cancelLabel,
		danger = false,
		busy = false,
		onConfirm,
		onCancel,
		children
	}: ConfirmDialogProps = $props();

	let dialog = $state<HTMLDialogElement>();

	// Drive the native <dialog> from `open`, both directions (matches the app's
	// other modals). showModal() gives the backdrop, focus trap, and Esc for free.
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function cancel() {
		if (busy) return;
		open = false;
		onCancel?.();
	}
</script>

<dialog
	bind:this={dialog}
	oncancel={(e) => {
		// Native Esc → cancel, unless an action is in flight.
		e.preventDefault();
		cancel();
	}}
	onclose={() => (open = false)}
	onclick={(e) => {
		// Click on the backdrop (target is the dialog itself) cancels.
		if (e.target === dialog) cancel();
	}}
	class="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
>
	<div class="flex flex-col gap-4 p-6">
		<h2 class="font-homemade-apple text-xl text-olf-darkbrown">{title}</h2>
		{#if children}
			<div class="font-oswald text-sm text-olf-darkgreen/80">{@render children()}</div>
		{/if}
		<div class="flex justify-end gap-2">
			<button
				type="button"
				onclick={cancel}
				disabled={busy}
				class="rounded-md px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen disabled:opacity-50"
			>
				{cancelLabel}
			</button>
			<button
				type="button"
				onclick={onConfirm}
				disabled={busy}
				class="flex items-center gap-1.5 rounded-md px-4 py-1.5 font-oswald text-xs font-bold text-olf-eggshell disabled:opacity-60 {danger
					? 'bg-olf-red'
					: 'bg-olf-darkgreen'}"
			>
				{#if busy}<Spinner size={14} />{/if}
				{confirmLabel}
			</button>
		</div>
	</div>
</dialog>

<style>
	/* Fade + scale the dialog and its backdrop on open/close. @starting-style +
	   allow-discrete is the modern native-<dialog> transition pattern (no JS). */
	dialog {
		opacity: 0;
		transform: scale(0.96) translateY(8px);
		transition:
			opacity 0.18s ease,
			transform 0.18s ease,
			overlay 0.18s ease allow-discrete,
			display 0.18s ease allow-discrete;
	}
	dialog[open] {
		opacity: 1;
		transform: scale(1) translateY(0);
	}
	@starting-style {
		dialog[open] {
			opacity: 0;
			transform: scale(0.96) translateY(8px);
		}
	}

	dialog::backdrop {
		opacity: 0;
		transition:
			opacity 0.18s ease,
			overlay 0.18s ease allow-discrete,
			display 0.18s ease allow-discrete;
	}
	dialog[open]::backdrop {
		opacity: 1;
	}
	@starting-style {
		dialog[open]::backdrop {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		dialog,
		dialog::backdrop {
			transition-duration: 0.01ms;
		}
	}
</style>
