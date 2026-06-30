<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { page } from '$app/state';
	import { orderModal } from '$lib/stores/orderModal.svelte';
	import { subscriptionModal } from '$lib/stores/subscriptionModal.svelte';
	import type { Session } from '@meteorclass/pigweed-contract';
	import { LOGO } from '$lib/config/assets';

	const year = new Date().getFullYear();
	const sessionUser = $derived((page.data as { session?: Session | null }).session?.user ?? null);
	const signedIn = $derived(!!sessionUser);
</script>

<footer class="w-full bg-olf-beige px-6 py-10 text-olf-darkgreen">
	<div class="mx-auto flex max-w-4xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
		<div>
			<img src={LOGO} alt="Our Little Farm" class="h-6 w-auto" />
			<p class="mt-2 font-oswald text-sm">{m.footer_tagline()}</p>
		</div>

		<nav class="flex flex-wrap items-center gap-x-5 gap-y-2 font-oswald text-sm">
			{#if signedIn}
				<a href="/users/{sessionUser?.id}?tab=settings" class="hover:text-olf-darkbrown"
					>{m.footer_link_account()}</a
				>
			{:else}
				<a href="/signup" class="hover:text-olf-darkbrown">{m.footer_link_make_account()}</a>
			{/if}
			<a href="/posts" class="hover:text-olf-darkbrown">{m.footer_link_posts()}</a>
			<button
				type="button"
				onclick={() => (orderModal.open = true)}
				class="hover:text-olf-darkbrown"
			>
				{m.home_order_eggs()}
			</button>
			<button
				type="button"
				onclick={() => (subscriptionModal.open = true)}
				class="hover:text-olf-darkbrown"
			>
				{m.subscribe_nav()}
			</button>
		</nav>
	</div>

	<p class="mx-auto mt-8 max-w-4xl font-oswald text-xs text-olf-moss/70">
		{m.footer_copyright({ year })}
	</p>
</footer>
