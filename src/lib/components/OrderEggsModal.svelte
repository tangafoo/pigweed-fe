<script lang="ts">
	import { Minus, Plus, X } from '@lucide/svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { orderModal } from '$lib/stores/orderModal.svelte';

	// Egg ordering is the only live product, so the modal is hardcoded for it:
	// fixed-size boxes of 15, ordered over WhatsApp.
	const PHONE = '60172332992';
	const UNIT = 15;

	let dialog = $state<HTMLDialogElement>();
	let quantity = $state(1);

	const total = $derived(quantity * UNIT);
	const whatsAppUrl = $derived(
		`https://wa.me/${PHONE}?text=${encodeURIComponent(
			m.home_eggs_order_message({ boxes: quantity, total })
		)}`
	);

	// Drive the native <dialog> from the shared store, in both directions.
	$effect(() => {
		if (!dialog) return;
		if (orderModal.open && !dialog.open) dialog.showModal();
		else if (!orderModal.open && dialog.open) dialog.close();
	});

	const close = () => (orderModal.open = false);
</script>

<dialog
	bind:this={dialog}
	onclose={close}
	onclick={(e) => {
		// Click on the backdrop (target is the dialog itself) closes it.
		if (e.target === dialog) close();
	}}
	class="m-auto w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
>
	<div class="flex flex-col gap-5 p-6">
		<div class="flex items-start justify-between gap-4">
			<h2 class="text-2xl font-bold">{m.home_order_how_many()}</h2>
			<button
				type="button"
				aria-label={m.home_order_close()}
				onclick={close}
				class="shrink-0 text-olf-darkgreen/60 hover:text-olf-darkgreen"
			>
				<X size={22} />
			</button>
		</div>

		<div class="flex items-center justify-between gap-3">
			<span class="font-oswald text-sm tracking-wide text-olf-darkgreen/80 uppercase">
				{m.home_order_boxes_label()}
			</span>
			<div class="flex items-center gap-3">
				<button
					type="button"
					aria-label="Decrease quantity"
					onclick={() => (quantity = Math.max(1, quantity - 1))}
					disabled={quantity <= 1}
					class="flex size-9 items-center justify-center bg-olf-darkgreen text-olf-beige disabled:opacity-40"
				>
					<Minus size={18} />
				</button>
				<span class="w-10 text-center text-2xl font-bold tabular-nums">{quantity}</span>
				<button
					type="button"
					aria-label="Increase quantity"
					onclick={() => (quantity += 1)}
					class="flex size-9 items-center justify-center bg-olf-darkgreen text-olf-beige"
				>
					<Plus size={18} />
				</button>
			</div>
		</div>

		<div
			class="flex items-center justify-between rounded-xl bg-olf-lightgreen px-4 py-3 text-olf-darkgreen"
		>
			<span class="font-oswald text-xs tracking-wide uppercase opacity-80">
				{m.home_order_box_note({ count: UNIT })}
			</span>
			<span class="font-oswald text-xl font-bold tabular-nums">
				{m.home_order_eggs_total({ count: total })}
			</span>
		</div>
		<p class="-mt-2 text-center font-oswald text-xs text-olf-darkgreen/70">
			{m.home_delivery_schedule()}
		</p>

		<a
			href={whatsAppUrl}
			target="_blank"
			rel="noopener noreferrer"
			onclick={close}
			class="rounded-xl bg-olf-darkbrown py-4 text-center text-sm font-bold tracking-widest text-olf-beige uppercase"
		>
			{m.home_order_whatsapp_cta()}
		</a>
	</div>
</dialog>
