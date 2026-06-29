<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import SubscriptionPanel from '$lib/components/SubscriptionPanel.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{m.subscribe_page_title()} · Our Little Farm</title>
	<meta name="description" content={m.subscribe_page_lead()} />
</svelte:head>

<section class="flex flex-1 flex-col gap-8 bg-olf-beige px-4 py-10 text-olf-darkgreen sm:px-6">
	<header class="mx-auto flex max-w-2xl flex-col items-center gap-2 text-center">
		<span class="text-4xl">🐔🥚</span>
		<h1 class="font-homemade-apple text-4xl font-bold tracking-wide">{m.subscribe_page_title()}</h1>
		<p class="font-oswald text-base opacity-80">{m.subscribe_page_lead()}</p>
	</header>

	<div class="mx-auto w-full max-w-5xl">
		<SubscriptionPanel plans={data.plans} subscription={data.subscription} stats={data.stats} />
	</div>
</section>
