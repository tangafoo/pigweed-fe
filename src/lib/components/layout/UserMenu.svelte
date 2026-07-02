<script lang="ts">
	import { UserRound } from '@lucide/svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '$lib/api/auth';
	import { orderModal } from '$lib/stores/orderModal.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import type { Session } from '@meteorclass/pigweed-contract';

	let { userId }: { userId: string | null } = $props();

	const user = $derived((page.data as { session?: Session | null }).session?.user ?? null);
	// Admin-panel link is gated on the session's isAdmin flag.
	const isAdmin = $derived(!!user?.isAdmin);

	let open = $state(false);
	let signingOut = $state(false);

	const ICON =
		'flex size-8 items-center justify-center rounded-full bg-olf-darkgreen/10 text-olf-darkgreen hover:bg-olf-darkgreen/20';
	const ITEM =
		'block w-full px-4 py-2 text-left font-oswald text-sm text-olf-darkgreen hover:bg-olf-darkgreen/10';

	async function signOut() {
		if (signingOut) return;
		signingOut = true;
		try {
			await authClient.signOut();
			await invalidateAll();
			await goto('/login');
		} finally {
			signingOut = false;
			open = false;
		}
	}
	function orderEggs() {
		open = false;
		orderModal.open = true;
	}
</script>

{#if !userId}
	<a href="/login" aria-label={m.home_signin_link()} class={ICON}>
		<UserRound size={18} />
	</a>
{:else}
	<div class="relative">
		<button
			type="button"
			onclick={() => (open = !open)}
			aria-label={m.home_profile_link()}
			aria-haspopup="menu"
			aria-expanded={open}
			class="rounded-full transition-opacity hover:opacity-90"
		>
			{#if user}
				<Avatar animal={user.animal} avatarSeed={user.avatarSeed} gender={user.gender} size="sm" />
			{:else}
				<span class={ICON}><UserRound size={18} /></span>
			{/if}
		</button>

		{#if open}
			<!-- Outside-click catcher -->
			<button
				type="button"
				aria-label="Close menu"
				class="fixed inset-0 z-40 cursor-default"
				onclick={() => (open = false)}
			></button>
			<div
				role="menu"
				class="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl bg-olf-beige py-1 shadow-xl ring-1 ring-olf-darkgreen/10"
			>
				{#if user}
					<p class="truncate px-4 py-2 font-supermercado-one text-sm text-olf-darkbrown">
						{user.username}
					</p>
					<div class="my-1 border-t border-olf-darkgreen/10"></div>
				{/if}
				<a role="menuitem" href="/users/{userId}" onclick={() => (open = false)} class={ITEM}>
					{m.home_profile_link()}
				</a>
				<button role="menuitem" type="button" onclick={orderEggs} class={ITEM}>
					{m.home_order_eggs()}
				</button>
				<a role="menuitem" href="/posts" onclick={() => (open = false)} class={ITEM}>
					{m.footer_link_posts()}
				</a>
				<a
					role="menuitem"
					href="/users/{userId}?tab=settings"
					onclick={() => (open = false)}
					class={ITEM}
				>
					{m.profile_settings_button()}
				</a>
				{#if isAdmin}
					<div class="my-1 border-t border-olf-darkgreen/10"></div>
					<a role="menuitem" href="/admin" onclick={() => (open = false)} class={ITEM}>
						{m.nav_admin_panel()}
					</a>
				{/if}
				<div class="my-1 border-t border-olf-darkgreen/10"></div>
				<button
					role="menuitem"
					type="button"
					onclick={signOut}
					disabled={signingOut}
					class="{ITEM} font-bold text-olf-darkbrown disabled:opacity-50"
				>
					{m.home_signout_button()}
				</button>
			</div>
		{/if}
	</div>
{/if}
