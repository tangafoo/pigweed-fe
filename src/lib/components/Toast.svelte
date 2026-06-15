<script lang="ts">
	import { toasts } from '$lib/realtime/toasts.svelte';
	import { fly } from 'svelte/transition';
	import { X } from '@lucide/svelte';
</script>

{#if toasts.items.length > 0}
	<div class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
		{#each toasts.items as t (t.id)}
			<div
				transition:fly={{ y: 20, duration: 250 }}
				class="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl bg-olf-darkgreen px-4 py-3 text-white shadow-lg"
			>
				<div class="min-w-0 flex-1">
					<p class="truncate font-oswald font-bold">{t.title}</p>
					{#if t.subtitle}
						<p class="font-oswald text-xs text-olf-lightgreen">{t.subtitle}</p>
					{/if}
				</div>
				<button
					type="button"
					onclick={() => toasts.dismiss(t.id)}
					aria-label="Dismiss"
					class="shrink-0 rounded-full p-1 text-white/70 hover:text-white"
				>
					<X size={16} />
				</button>
			</div>
		{/each}
	</div>
{/if}
