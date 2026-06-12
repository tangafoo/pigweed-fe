<script lang="ts">
	import type { PageData } from './$types';
	import { m } from '$lib/paraglide/messages.js';
	import { formatRelative } from '$lib/utils/date';
	import Avatar from '$lib/components/Avatar.svelte';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import ProfileTabs from '$lib/components/ProfileTabs.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { absoluteUrl, SITE_NAME } from '$lib/seo';
	import { ANIMAL_LABEL } from '$lib/utils/labels';
	import { Settings } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();
	const profile = $derived(data.profile);

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

<div class="min-h-[60dvh] bg-olf-lightgreen px-4 py-10">
	<div class="mx-auto max-w-2xl">
		<section class="mb-6 rounded-2xl bg-olf-beige p-6">
			<div class="flex items-center gap-5">
				<Avatar
					size="lg"
					animal={profile.animal}
					avatarSeed={profile.avatarSeed}
					gender={profile.gender}
				/>
				<div class="min-w-0 flex-1">
					<h1 class="font-supermercado-one text-2xl font-bold wrap-break-word text-olf-darkbrown">
						{profile.username}
					</h1>
					<p class="font-oswald text-olf-darkbrown/70">
						{m.profile_animal_line({ animal: ANIMAL_LABEL[profile.animal]() })}
					</p>
					<p class="font-oswald text-sm text-olf-darkbrown/60">
						{m.profile_hatched({ when: formatRelative(profile.createdAt) })}
					</p>
				</div>
			</div>

			<div class="mt-4 flex flex-wrap items-center gap-2 font-oswald text-sm">
				<span class="rounded-full bg-olf-darkbrown px-3 py-1 text-white">
					{m.profile_stat_posts({ count: profile.postCount })}
				</span>
				<span class="rounded-full bg-olf-darkbrown px-3 py-1 text-white">
					{m.profile_stat_comments({ count: profile.commentCount })}
				</span>
			</div>

			{#if data.isOwner}
				<a
					href="/settings"
					class="mt-4 inline-flex items-center gap-1.5 rounded-full bg-olf-darkbrown px-4 py-2 font-oswald text-sm font-bold text-white"
				>
					<Settings size={16} />
					{m.profile_settings_button()}
				</a>
			{/if}
		</section>

		{#key profile.id}
			<ProfileTabs userId={profile.id} />
		{/key}
	</div>
</div>
