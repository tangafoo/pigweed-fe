<script lang="ts">
	import { page } from '$app/state';
	import { NAV_ITEMS } from '$lib/config/nav';

	/**
	 * Mobile bottom drawer for the top-bar items. A native <dialog> (free
	 * focus-trap + Esc + overlay via ::backdrop), sliding up from the bottom.
	 */
	let { open = $bindable() }: { open: boolean } = $props();

	let dialog = $state<HTMLDialogElement>();

	// Drive the native <dialog> from `open`, both directions.
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	// Close on navigation.
	$effect(() => {
		void page.url.pathname;
		open = false;
	});

	const ITEM =
		'block w-full rounded-xl px-4 py-3 text-center font-oswald text-lg tracking-wide text-olf-darkgreen hover:bg-olf-darkgreen/10 aria-[current=page]:bg-olf-darkgreen aria-[current=page]:text-olf-beige';
</script>

<dialog
	bind:this={dialog}
	onclose={() => (open = false)}
	onclick={(e) => {
		// Click on the overlay (target is the dialog itself) closes.
		if (e.target === dialog) open = false;
	}}
	class="mx-0 mt-auto mb-0 w-full max-w-none rounded-t-2xl bg-olf-sunfadedsage/80 backdrop-blur-md backdrop:bg-olf-chimera/75"
>
	<nav class="flex flex-col gap-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
		<div class="mx-auto mb-2 h-1 w-10 rounded-full bg-olf-darkgreen/30" aria-hidden="true"></div>
		{#each NAV_ITEMS as item, i (i)}
			{#if item.href}
				<a
					href={item.href}
					aria-current={page.url.pathname.startsWith(item.href) ? 'page' : undefined}
					class={ITEM}
				>
					{item.label()}
				</a>
			{:else}
				<span class={ITEM}>{item.label()}</span>
			{/if}
		{/each}
	</nav>
</dialog>

<style>
	/* Slide the drawer up and fade the overlay. @starting-style +
	   allow-discrete is the native-<dialog> transition pattern (no JS). */
	dialog {
		transform: translateY(100%);
		transition:
			transform 0.25s ease,
			overlay 0.25s ease allow-discrete,
			display 0.25s ease allow-discrete;
	}
	dialog[open] {
		transform: translateY(0);
	}
	@starting-style {
		dialog[open] {
			transform: translateY(100%);
		}
	}

	dialog::backdrop {
		opacity: 0;
		transition:
			opacity 0.25s ease,
			overlay 0.25s ease allow-discrete,
			display 0.25s ease allow-discrete;
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
