<script lang="ts">
	import NoIcon from '$lib/components/NoIcon.svelte';
	import Parallax from '$lib/components/Parallax.svelte';
	import { Sun, CloudRain, HeartCrack, FlaskConical } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const session = $derived(data.session);
	const weather = $derived(data.weather);
	const userCount = $derived(data.userCount);
</script>

<div class="flex w-full items-center bg-olf-darkbrown px-2 py-3">
	<h1 class="font-homemade-apple font-bold tracking-wider text-white">Our Little Farm</h1>
	{#if userCount !== null}
		<span class="ml-auto font-supermercado-one text-sm text-white">
			{userCount} users
		</span>
	{/if}
</div>

<Parallax
	src="https://pub-9ed0a91dba4749879e89a94774f50169.r2.dev/chicken%20hero.webp"
	srcLg="https://pub-9ed0a91dba4749879e89a94774f50169.r2.dev/farm%20hero.webp"
	class="flex items-center lg:h-[50dvh]"
>
	<div class="px-6 py-16">
		<div class="relative mb-5 flex">
			<p class="flex-1 font-homemade-apple text-4xl font-bold text-white/95">
				Organic farm in Malaysia
			</p>
			<div class="ml-3 flex flex-col gap-2 self-end lg:flex-row">
				<p class="flex items-center gap-1 self-end rounded-full bg-olf-beige px-2">
					<Sun size={12} class="shrink-0" />
					{weather ? `${weather.temperature}°C` : 'Heat'}
				</p>
				<p class="flex items-center gap-1 self-end rounded-full bg-olf-beige px-2">
					<CloudRain size={12} class="shrink-0" />
					{weather ? `${weather.humidity}% humidity` : 'Humidity'}
				</p>
			</div>
		</div>

		<div class="relative flex gap-4">
			<p class="flex flex-col gap-1 text-xl text-white/90">
				<NoIcon icon={HeartCrack} size={60} />
				Cruelty-free
			</p>
			<p class="flex flex-col gap-1 text-xl text-white/90">
				<NoIcon icon={FlaskConical} size={60} />
				No chemicals
			</p>
		</div>
	</div>
</Parallax>
<div class="flex h-20 w-full items-center justify-between bg-olf-lightgreen px-2">
	<h1 class="text-3xl font-bold text-white">Eggs?</h1>
	<p>preorder</p>
</div>
<p class="bg-olf-beige p-4 text-center">See what the chickens are saying</p>

<div class="flex w-full items-center justify-between bg-olf-darkbrown px-4 py-3 text-white">
	{#if session}
		<p class=" text-lg">
			Clucking as <span class="font-bold">{session.user.username}</span>
		</p>
		<span class="rounded-full bg-olf-lightgreen px-3 py-1 text-sm">
			🪙 {session.user.coinBalance}
		</span>
	{:else}
		<p class=" text-lg">You're browsing as a stranger</p>
		<a href="/login" class="rounded-full bg-olf-lightgreen px-3 py-1 text-sm font-bold">
			Sign in
		</a>
	{/if}
</div>
<div class="h-96"></div>
