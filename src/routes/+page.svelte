<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/api/auth';
	import NoIcon from '$lib/components/NoIcon.svelte';
	import Parallax from '$lib/components/Parallax.svelte';
	import ProduceOrderButtons from '$lib/components/ProduceOrderButtons.svelte';
	import { produceSections } from '$lib/produceSections';
	import { m } from '$lib/paraglide/messages.js';
	import { Sun, CloudRain, HeartCrack, FlaskConical, UserRound } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const session = $derived(data.session);
	const weather = $derived(data.weather);

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
{#each produceSections as section (section.heading)}
	<ProduceOrderButtons {...section} />
{/each}

<p class="bg-olf-beige p-4 text-center">{m.home_feed_teaser()}</p>

<div class="flex w-full items-center justify-between bg-olf-darkbrown px-4 py-3 text-white">
	{#if session}
		<p class=" text-lg">
			{m.home_signed_in_as()} <span class="font-bold">{session.user.username}</span>
		</p>
		<div class="flex items-center gap-2">
			<a
				href="/users/{session.user.id}"
				aria-label={m.home_profile_link()}
				class="flex h-8 w-8 items-center justify-center rounded-full bg-olf-lightgreen text-olf-darkbrown"
			>
				<UserRound size={16} />
			</a>
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
