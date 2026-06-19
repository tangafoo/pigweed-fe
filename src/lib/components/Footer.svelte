<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { page } from '$app/state';
	import { orderModal } from '$lib/stores/orderModal.svelte';
	import type { Session } from '@meteorclass/pigweed-contract';

	const year = new Date().getFullYear();
	const signedIn = $derived(!!(page.data as { session?: Session | null }).session);
</script>

<footer class="w-full bg-olf-darkgreen px-6 py-10 text-white">
	<div class="mx-auto flex max-w-4xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
		<div>
			<p class="font-homemade-apple text-2xl font-bold tracking-wider">Our Little Farm</p>
			<p class="mt-1 font-oswald text-sm text-white/70">{m.footer_tagline()}</p>
		</div>

		<nav class="flex flex-wrap items-center gap-x-5 gap-y-2 font-oswald text-sm">
			{#if signedIn}
				<a href="/settings" class="hover:text-olf-lightgreen">{m.footer_link_account()}</a>
			{:else}
				<a href="/signup" class="hover:text-olf-lightgreen">{m.footer_link_make_account()}</a>
			{/if}
			<a href="/posts" class="hover:text-olf-lightgreen">{m.footer_link_posts()}</a>
			<button
				type="button"
				onclick={() => (orderModal.open = true)}
				class="hover:text-olf-lightgreen"
			>
				{m.home_order_eggs()}
			</button>
		</nav>
	</div>

	<p class="mx-auto mt-8 max-w-4xl font-oswald text-xs text-white/50">
		{m.footer_copyright({ year })}
	</p>
</footer>
