<script lang="ts">
	import { onMount } from 'svelte';
	import { getSession, type Session } from '$lib/api/auth';

	let session = $state<Session | null>(null);
	let loading = $state(true);

	onMount(async () => {
		session = await getSession();
		loading = false;
	});
</script>

<div class="flex w-full items-center bg-olf-darkbrown px-2 py-3">
	<h1 class="font-homemade-apple font-bold tracking-wider text-white">Our Little Farm</h1>
</div>
<div class="flex h-[50dvh] items-center bg-blue-50">
	<div class="flex items-center p-6">
		<p class="flex-0 font-homemade-apple text-4xl font-bold">Organic farm in Malaysia</p>
		<p class="w-fit self-end rounded-full bg-indigo-700 px-2 font-oswald text-xl text-white/90">
			Heat & Humidity
		</p>
	</div>
</div>
<div class="flex h-20 w-full items-center justify-between bg-olf-lightgreen px-2">
	<h1 class="text-3xl font-bold text-white">Eggs?</h1>
	<p>preorder</p>
</div>
<p class="bg-olf-beige p-4 text-center">See what the chickens are saying</p>

<div class="flex w-full items-center justify-between bg-olf-darkbrown px-4 py-3 text-white">
	{#if loading}
		<p class="font-oswald text-white/70">Checking the coop…</p>
	{:else if session}
		<p class="font-oswald text-lg">
			Clucking as <span class="font-bold">{session.user.username}</span>
		</p>
		<span class="rounded-full bg-olf-lightgreen px-3 py-1 font-oswald text-sm">
			🪙 {session.user.coinBalance}
		</span>
	{:else}
		<p class="font-oswald text-lg">You're browsing as a stranger</p>
		<a
			href="/login"
			class="rounded-full bg-olf-lightgreen px-3 py-1 font-oswald text-sm font-bold"
		>
			Sign in
		</a>
	{/if}
</div>
