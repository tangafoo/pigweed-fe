<script lang="ts">
	import type { PageData } from './$types';
	import { m } from '$lib/paraglide/messages.js';
	import { formatRelative } from '$lib/utils/date';
	import Avatar from '$lib/components/Avatar.svelte';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import ProfileTabs from '$lib/components/ProfileTabs.svelte';
	import SubscriptionPanel from '$lib/components/SubscriptionPanel.svelte';
	import AchievementsPanel from '$lib/components/AchievementsPanel.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import DashboardNav from '$lib/components/DashboardNav.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { absoluteUrl, SITE_NAME } from '$lib/seo';
	import { ANIMAL_LABEL } from '$lib/utils/labels';
	import { asset } from '$lib/assets';
	import { page } from '$app/state';

	let { data }: { data: PageData } = $props();
	const profile = $derived(data.profile);

	// Owner side-menu section (profile | subscription | achievements | settings) via ?tab=.
	type Section = 'profile' | 'subscription' | 'achievements' | 'settings';
	const SECTIONS: Section[] = ['profile', 'subscription', 'achievements', 'settings'];
	const tab = $derived(
		(SECTIONS.includes(page.url.searchParams.get('tab') as Section)
			? page.url.searchParams.get('tab')
			: 'profile') as Section
	);

	const profileDescription = $derived(
		`${profile.username} on ${SITE_NAME} — a ${ANIMAL_LABEL[profile.animal]().toLowerCase()} with ${profile.postCount} posts and ${profile.commentCount} comments.`
	);

	const profileJsonLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'ProfilePage',
		url: absoluteUrl(`/users/${profile.id}`),
		mainEntity: {
			'@type': 'Person',
			name: profile.username,
			identifier: profile.id,
			dateCreated: profile.createdAt,
			interactionStatistic: [
				{
					'@type': 'InteractionCounter',
					interactionType: 'https://schema.org/WriteAction',
					userInteractionCount: profile.postCount
				},
				{
					'@type': 'InteractionCounter',
					interactionType: 'https://schema.org/CommentAction',
					userInteractionCount: profile.commentCount
				}
			]
		}
	});
</script>

<Seo
	title={m.profile_page_title({ username: profile.username })}
	description={profileDescription}
	type="profile"
/>
<JsonLd data={profileJsonLd} />

<div class="flex-1 bg-olf-lightgreen px-4 py-8">
	<div class="mx-auto {data.isOwner ? 'max-w-6xl' : 'max-w-2xl'}">
		<!-- Identity card -->
		<section class="rounded-2xl bg-olf-eggshell p-4 shadow-md">
			<div class="flex items-center gap-3.5">
				<Avatar
					size="md"
					animal={profile.animal}
					avatarSeed={profile.avatarSeed}
					gender={profile.gender}
				/>
				<div class="min-w-0 flex-1">
					<h1 class="font-supermercado-one text-xl font-bold wrap-break-word text-olf-darkbrown">
						{profile.username}
					</h1>
					<p class="font-oswald text-sm text-olf-darkbrown/60">
						{m.profile_hatched({ when: formatRelative(profile.createdAt) })}
					</p>
				</div>
			</div>

			<div class="mt-4 flex flex-wrap items-center gap-2 font-oswald text-sm">
				{#if data.isOwner && data.coinBalance != null}
					<span
						class="flex items-center gap-1.5 rounded-full bg-olf-darkbrown px-3 py-1 text-white"
					>
						<img src={asset('egg05.webp')} alt="" class="h-4 w-4 shrink-0 object-contain" />
						{m.profile_stat_coins({ count: data.coinBalance })}
					</span>
				{/if}
				<span class="text-olf-darkbrown">{m.profile_stat_posts({ count: profile.postCount })}</span>
				<span class="text-olf-darkbrown"
					>{m.profile_stat_comments({ count: profile.commentCount })}</span
				>
			</div>
		</section>

		{#if data.isOwner}
			<!-- Dashboard: shared side menu + section -->
			<div class="mt-5 flex flex-col gap-5 sm:flex-row">
				<DashboardNav userId={profile.id} active={tab} />
				<div class="min-w-0 flex-1">
					{#if tab === 'subscription'}
						<SubscriptionPanel
							plans={data.plans}
							subscription={data.subscription}
							stats={data.stats}
							user={data.session!.user}
						/>
					{:else if tab === 'achievements'}
						<AchievementsPanel userId={profile.id} />
					{:else if tab === 'settings'}
						<SettingsPanel user={data.session!.user} subscription={data.subscription} />
					{:else}
						{#key profile.id}
							<ProfileTabs
								userId={profile.id}
								postCount={profile.postCount}
								postVoteCount={profile.postVoteCount}
								commentVoteCount={profile.commentVoteCount}
							/>
						{/key}
					{/if}
				</div>
			</div>
		{:else}
			<div class="mt-5">
				{#key profile.id}
					<ProfileTabs
						userId={profile.id}
						postCount={profile.postCount}
						postVoteCount={profile.postVoteCount}
						commentVoteCount={profile.commentVoteCount}
					/>
				{/key}
			</div>
		{/if}
	</div>
</div>
