<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/api/auth';
	import Footer from '$lib/components/Footer.svelte';
	import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
	import NoIcon from '$lib/components/NoIcon.svelte';
	import Parallax from '$lib/components/Parallax.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { Sun, CloudRain, HeartCrack, FlaskConical } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const session = $derived(data.session);
	const weather = $derived(data.weather);
	const userCount = $derived(data.userCount);

	let signingOut = $state(false);
	async function signOut() {
		if (signingOut) return;
		signingOut = true;
		try {
			await authClient.signOut();
			await invalidateAll();
			await goto('/login');
		} finally {
			signingOut = false;
		}
	}
</script>

<div class="flex w-full items-center gap-3 bg-olf-darkbrown px-2 py-3">
	<h1 class="font-homemade-apple font-bold tracking-wider text-white">Our Little Farm</h1>
	<div class="ml-auto flex items-center">
		{#if userCount !== null}
			<span class="font-supermercado-one text-sm text-white">
				{m.home_user_count({ count: userCount })}
			</span>
		{/if}
		<div class="mx-2 h-3.5 border-l border-white/60"></div>
		<LocaleSwitcher />
	</div>
</div>

<Parallax
	src="https://pub-9ed0a91dba4749879e89a94774f50169.r2.dev/chicken%20hero.webp"
	srcLg="https://pub-9ed0a91dba4749879e89a94774f50169.r2.dev/farm%20hero.webp"
	class="flex items-center lg:h-[50dvh]"
>
	<div class="px-6 py-16">
		<div class="relative mb-5 flex">
			<p class="flex-1 font-homemade-apple text-4xl font-bold text-white/95">
				{m.home_hero_title()}
			</p>
			<div class="ml-3 flex flex-col gap-2 self-end lg:flex-row">
				<p
					class="flex items-center gap-1 self-start rounded-full bg-olf-beige/80 px-2 backdrop-blur-md"
				>
					<Sun size={12} class="shrink-0" />
					{weather ? `${weather.temperature}°C` : m.home_weather_heat_fallback()}
				</p>
				<p
					class="flex items-center gap-1 self-start rounded-full bg-olf-beige/80 px-2 backdrop-blur-md"
				>
					<CloudRain size={12} class="shrink-0" />
					{weather
						? m.home_weather_humidity({ value: weather.humidity })
						: m.home_weather_humidity_fallback()}
				</p>
			</div>
		</div>

		<div class="relative flex gap-4">
			<p class="flex flex-col gap-1 text-white/90">
				<NoIcon icon={HeartCrack} size={55} />
				{m.home_no_cruelty()}
			</p>
			<p class="flex flex-col gap-1 text-white/90">
				<NoIcon icon={FlaskConical} size={55} />
				{m.home_no_chemicals()}
			</p>
		</div>
	</div>
</Parallax>
<div class="flex h-20 w-full items-center justify-between bg-olf-lightgreen px-2">
	<h1 class="text-3xl font-bold text-white">{m.home_eggs_heading()}</h1>
	<p>{m.home_eggs_preorder()}</p>
</div>
<p class="bg-olf-beige p-4 text-center">{m.home_feed_teaser()}</p>

<div class="flex w-full items-center justify-between bg-olf-darkbrown px-4 py-3 text-white">
	{#if session}
		<p class=" text-lg">
			{m.home_signed_in_as()} <span class="font-bold">{session.user.username}</span>
		</p>
		<div class="flex items-center gap-2">
			<span class="rounded-full bg-olf-lightgreen px-3 py-1 text-sm">
				🪙 {session.user.coinBalance}
			</span>
			<button
				type="button"
				onclick={signOut}
				disabled={signingOut}
				class="rounded-full bg-olf-lightbrown px-3 py-1 text-sm font-bold text-olf-darkbrown disabled:opacity-50"
			>
				{signingOut ? m.home_signout_in_progress() : m.home_signout_button()}
			</button>
		</div>
	{:else}
		<p class=" text-lg">{m.home_stranger()}</p>
		<a href="/login" class="rounded-full bg-olf-lightgreen px-3 py-1 text-sm font-bold">
			{m.home_signin_link()}
		</a>
	{/if}
</div>

<Footer />
