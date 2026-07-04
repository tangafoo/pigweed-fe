<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { Crown, Sparkles, X } from '@lucide/svelte';

	// The "what's this badge?" reveal — a curious viewer taps a farm-owner or
	// founding-flock badge and learns what it means. Deliberately per-badge (no
	// "all badges" gallery): the badges stay a little secret to discover.
	let { variant, open = $bindable(false) }: { variant: 'owner' | 'founder'; open?: boolean } =
		$props();

	const meta = $derived(
		variant === 'owner'
			? {
					label: m.posts_op_badge(),
					body: m.posts_op_tooltip(),
					pill: 'bg-olf-darkgreen text-white',
					Icon: Crown
				}
			: {
					label: m.subscribe_founder_badge(),
					body: m.subscribe_founder_tooltip(),
					pill: 'bg-olf-yolk text-olf-eggshell',
					Icon: Sparkles
				}
	);

	const Icon = $derived(meta.Icon);

	let dialog = $state<HTMLDialogElement>();
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	onclose={() => (open = false)}
	onclick={(e) => {
		if (e.target === dialog) open = false;
	}}
	class="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-olf-beige text-olf-darkbrown backdrop:bg-olf-darkgreen/60"
>
	<div class="relative flex flex-col items-center gap-3 p-6 text-center">
		<button
			type="button"
			aria-label={m.achievements_close()}
			onclick={() => (open = false)}
			class="absolute top-3 right-3 text-olf-darkbrown/50 hover:text-olf-darkbrown"
		>
			<X size={18} />
		</button>
		<span class="flex size-14 items-center justify-center rounded-full {meta.pill} shadow-inner">
			<Icon size={26} />
		</span>
		<span
			class="rounded px-2 py-0.5 font-oswald text-sm font-bold tracking-wider uppercase {meta.pill}"
		>
			{meta.label}
		</span>
		<p class="max-w-xs font-oswald text-sm leading-relaxed text-olf-darkbrown/80">{meta.body}</p>
	</div>
</dialog>

<style>
	dialog {
		opacity: 0;
		transform: scale(0.95) translateY(8px);
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
			transform: scale(0.95) translateY(8px);
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
