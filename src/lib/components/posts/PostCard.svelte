<script lang="ts">
	import type {
		Post,
		Session,
		VoteValue,
		VoteResponse,
		AwardSummary
	} from '@meteorclass/pigweed-contract';
	import { untrack } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { setPostVote, clearPostVote } from '$lib/api/votes';
	import { asset } from '$lib/config/assets';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Badge from '$lib/components/posts/Badge.svelte';
	import AwardModal from '$lib/components/posts/AwardModal.svelte';
	import AwardGrantersModal from '$lib/components/posts/AwardGrantersModal.svelte';
	import {
		Star,
		ArrowBigUp,
		ArrowBigDown,
		Gift,
		MessageSquare,
		Maximize2,
		Minimize2,
		MapPin,
		Pencil,
		Trash2
	} from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import { CATEGORY_COLOR, CATEGORY_EMOJI } from '$lib/config/categories';
	import { formatRelative } from '$lib/utils/date';
	import { distanceKm, type LatLng } from '$lib/utils/geo';

	interface PostCardProps {
		post: Post;
		/** Fixed-width, shorter card for the home carousel strip. */
		compact?: boolean;
		/**
		 * Live comment count for the detail page, which owns the thread and
		 * updates as comments are posted. Omitted in the feed → the post's own
		 * server count is shown.
		 */
		liveCommentCount?: number;
		/** Start with the image expanded (full height) — used on the detail page. */
		expandImage?: boolean;
		/**
		 * Render the whole body untruncated — the detail page. Elsewhere the body
		 * clamps: 7 lines in the feed, a single truncated line on compact cards.
		 */
		fullBody?: boolean;
		/**
		 * Viewer's current location, when known (feed "Near me"). Drives the
		 * "~N km away" suffix on the origin line. Omitted → no distance shown.
		 */
		viewerLocation?: LatLng | null;
		/**
		 * Show the author-only manage menu (pencil → edit/delete) next to the
		 * timestamp. The card owns none of the logic — it just calls back.
		 */
		canManage?: boolean;
		onEdit?: () => void;
		onDelete?: () => void;
	}
	let {
		post,
		compact = false,
		liveCommentCount,
		expandImage = false,
		fullBody = false,
		viewerLocation = null,
		canManage = false,
		onEdit,
		onDelete
	}: PostCardProps = $props();

	// Author manage dropdown (edit/delete). Same open/outside-click/Esc pattern
	// as FilterDropdown/LocaleSwitcher.
	let menuOpen = $state(false);
	let menuRoot = $state<HTMLElement>();
	$effect(() => {
		if (!menuOpen) return;
		const onClick = (e: MouseEvent) => {
			if (menuRoot && !menuRoot.contains(e.target as Node)) menuOpen = false;
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') menuOpen = false;
		};
		document.addEventListener('click', onClick);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('click', onClick);
			document.removeEventListener('keydown', onKey);
		};
	});

	const commentCount = $derived(liveCommentCount ?? post.commentCount);

	const signedIn = $derived(!!(page.data as { session?: Session | null }).session?.user);

	// Optimistic override of the post's vote tallies. `null` → show the prop's
	// server values; set the moment the viewer votes, then reconciled to the
	// server's authoritative numbers on response. Cleared when the card is
	// reused for a different post id (feed refetch / carousel reuse).
	let override = $state<VoteResponse | null>(null);
	let voting = $state(false);
	$effect(() => {
		// Reading post.id registers it as the only dependency, so the overrides
		// reset exactly when this card is reused for a different post.
		if (post.id) {
			override = null;
			awardsOverride = null;
		}
	});

	const myVote = $derived(override ? override.myVote : post.myVote);
	const upvotes = $derived(override ? override.upvoteCount : post.upvoteCount);
	const downvotes = $derived(override ? override.downvoteCount : post.downvoteCount);
	const net = $derived(upvotes - downvotes);

	async function vote(value: VoteValue) {
		// Voting needs a session; bounce signed-out viewers to login.
		if (!signedIn) return void goto('/login');
		if (voting) return;
		voting = true;

		// Toggle: clicking the active vote clears it; otherwise set/switch.
		const removing = myVote === value;
		const rollback = override;

		// Optimistic update — back out any existing vote, then apply the new one.
		let up = upvotes;
		let down = downvotes;
		if (myVote === 'UP') up--;
		else if (myVote === 'DOWN') down--;
		if (!removing) {
			if (value === 'UP') up++;
			else down++;
		}
		override = { upvoteCount: up, downvoteCount: down, myVote: removing ? null : value };

		const res = removing ? await clearPostVote(post.id) : await setPostVote(post.id, value);
		// Reconcile against the server's authoritative counts, or roll back on
		// failure (incl. a stale-session 401).
		override = res ?? rollback;
		voting = false;
	}

	// Brand: a card's border grows bushier with its net score (1px–6px).
	const bushiness = $derived(Math.max(1, Math.min(6, 1 + net / 4)));

	const thumb = $derived(post.media.find((m) => m.kind === 'image') ?? post.media[0] ?? null);

	const categoryLabel = (c: NonNullable<Post['category']>) =>
		c === 'EGGS'
			? m.posts_cat_eggs()
			: c === 'VEGGIES'
				? m.posts_cat_veggies()
				: c === 'FRUITS'
					? m.posts_cat_fruits()
					: m.posts_cat_animals();

	// Gift-an-award flow. `awardsOverride` mirrors the vote override: an
	// optimistic local bump of the award stack after the viewer gifts, reset
	// when the card is reused (see the post.id effect above).
	let giftOpen = $state(false);
	let awardsOverride = $state<AwardSummary[] | null>(null);
	const awards = $derived(awardsOverride ?? post.awards);
	// Reddit-style: the top award types render as tiny icons next to the gift
	// button, with the total gifted count.
	const topAwards = $derived(awards.slice(0, 3));
	const totalAwards = $derived(awards.reduce((n, a) => n + a.count, 0));
	const awardsTitle = $derived(awards.map((a) => `${a.name} ×${a.count}`).join(' · '));

	function openGift() {
		if (!signedIn) return void goto('/login');
		giftOpen = true;
	}
	// Clicking the received-awards stack opens the who-gifted-this modal
	// (auth-gated on the BE, so signed-out viewers bounce to login).
	let grantersOpen = $state(false);
	function openGranters() {
		if (!signedIn) return void goto('/login');
		grantersOpen = true;
	}
	function onGranted(a: { id: string; assetKey: string; name: string }) {
		const next = awards.map((s) => (s.awardTypeId === a.id ? { ...s, count: s.count + 1 } : s));
		if (!next.some((s) => s.awardTypeId === a.id)) {
			next.push({ awardTypeId: a.id, assetKey: a.assetKey, name: a.name, count: 1 });
		}
		awardsOverride = next.sort((x, y) => y.count - x.count);
	}

	// Award badge art: <assetKey>.webp (bucket root) from the assets bucket, medal
	// emoji until the picture exists (or if it 404s).
	let brokenArt = $state<Record<string, boolean>>({});

	// Origin line bits, kept as two separate values so the template can place
	// the place label and the distance independently (distance is pushed to
	// the right). "~N km away" only when we know the viewer's location; floored
	// at 1 km so a nearby post never reads "~0 km".
	const kmAway = $derived(
		viewerLocation
			? Math.max(
					1,
					Math.round(distanceKm(viewerLocation, { lat: post.latitude, lng: post.longitude }))
				)
			: null
	);

	// Tap the expand button to let the image grow from the cropped thumbnail to
	// its full natural height, animated as a height slide. We animate an explicit
	// px height (CSS can't transition to `auto`): full height = the box's current
	// width × the image's aspect ratio, measured on load so it stays responsive.
	// Initial value only — the viewer can still toggle it afterward.
	let expanded = $state(untrack(() => expandImage));
	let boxW = $state(0);
	let aspect = $state<number | null>(null);
	const collapsedH = $derived(compact ? 144 : 176); // h-36 / h-44 in px
	const fullH = $derived(aspect && boxW ? Math.round(boxW * aspect) : collapsedH);
	const boxH = $derived(expanded ? fullH : collapsedH);
	function onImgLoad(e: Event) {
		const img = e.currentTarget as HTMLImageElement;
		if (img.naturalWidth) aspect = img.naturalHeight / img.naturalWidth;
	}
</script>

<article
	class="flex flex-col overflow-hidden rounded-xl bg-olf-eggshell shadow-md {compact
		? 'h-full w-64 shrink-0'
		: 'w-full'} {post.moderated ? '' : 'shiny'}"
	style="border: {bushiness}px solid var(--color-olf-darkgreen)"
>
	<!-- Stretched link scoped to the text block only — the beige whitespace
	     opens the post. The image (its own expand control) and the footer
	     (votes + comment link) are deliberately outside this region. Author
	     links sit above it (z-20) so they still go to the profile. -->
	<div class="group relative flex flex-1 flex-col gap-2 p-3">
		<a
			href="/posts/{post.id}"
			aria-label={post.title}
			class="absolute inset-0 z-10 focus-visible:ring-2 focus-visible:ring-olf-darkgreen focus-visible:outline-none"
		></a>
		<!-- Author row -->
		<div class="flex items-center gap-2">
			<a
				href="/users/{post.author.id}"
				class="relative z-20 flex items-center gap-2"
				aria-label={post.author.username}
			>
				<Avatar
					animal={post.author.animal}
					avatarSeed={post.author.avatarSeed}
					gender={post.author.gender}
					size="sm"
				/>
			</a>
			<div class="flex min-w-0 flex-col gap-0.5">
				<span class="flex items-center gap-1.5">
					<a
						href="/users/{post.author.id}"
						class="relative z-20 truncate font-supermercado-one text-sm text-olf-darkbrown hover:underline"
					>
						{post.author.username}
					</a>
					{#if post.author.isFarmOwner}
						<Badge
							variant="owner"
							label={compact ? m.posts_op_badge_short() : m.posts_op_badge()}
							title={m.posts_op_tooltip()}
						/>
					{/if}
					{#if post.author.isFoundingFlock}
						<Badge
							variant="founder"
							label={compact ? m.subscribe_founder_badge_short() : m.subscribe_founder_badge()}
							title={m.subscribe_founder_tooltip()}
						/>
					{/if}
				</span>
				{#if post.rating != null}
					<span
						class="flex items-center gap-0.5"
						aria-label={m.posts_rating_label({ rating: post.rating })}
					>
						{#each [0, 1, 2, 3, 4] as i (i)}
							<Star
								size={16}
								class={i < post.rating ? 'fill-olf-yolk text-olf-yolk' : 'text-olf-darkbrown/25'}
							/>
						{/each}
					</span>
				{/if}
			</div>
			<div class="ml-auto flex shrink-0 items-center gap-1.5 self-start">
				<time
					datetime={String(post.createdAt)}
					class="shrink-0 font-oswald text-xxs text-olf-darkbrown/45"
				>
					{formatRelative(post.createdAt)}
				</time>
				{#if canManage}
					<!-- Above the stretched card link (z-20) so it's clickable. -->
					<div class="relative z-20" bind:this={menuRoot}>
						<button
							type="button"
							onclick={() => (menuOpen = !menuOpen)}
							aria-haspopup="menu"
							aria-expanded={menuOpen}
							aria-label={m.posts_manage()}
							class="flex size-6 items-center justify-center rounded-full text-olf-darkbrown/50 transition-colors hover:bg-olf-darkbrown/10 hover:text-olf-darkbrown"
						>
							<Pencil size={14} />
						</button>
						{#if menuOpen}
							<div
								role="menu"
								transition:slide={{ duration: 150 }}
								class="absolute right-0 z-30 mt-1 min-w-[8rem] overflow-hidden rounded-xl border border-olf-darkgreen/20 bg-olf-beige p-1 shadow-lg"
							>
								<button
									type="button"
									role="menuitem"
									onclick={() => {
										menuOpen = false;
										onEdit?.();
									}}
									class="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 font-oswald text-sm font-bold text-olf-darkbrown hover:bg-olf-darkgreen/10"
								>
									<Pencil size={14} class="shrink-0" />
									{m.posts_edit()}
								</button>
								<button
									type="button"
									role="menuitem"
									onclick={() => {
										menuOpen = false;
										onDelete?.();
									}}
									class="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 font-oswald text-sm font-bold text-olf-red hover:bg-olf-red/10"
								>
									<Trash2 size={14} class="shrink-0" />
									{m.posts_delete()}
								</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<div class="flex items-start gap-1.5">
			<!-- Plain text: the content-block stretched link owns navigation;
			     underlines when the text block (the `group`) is hovered. -->
			<p
				class="line-clamp-2 font-oswald font-bold tracking-wide text-olf-darkbrown group-hover:underline"
			>
				{post.title}
			</p>

			<!-- Emoji + category tag pin to the title's FIRST line (h-6 = one
			     text-base line-height), instead of floating at the vertical
			     middle when the title wraps to two lines. -->
			<span class="flex h-6 shrink-0 items-center gap-1.5">
				<p class="text-xxs">{post.category ? CATEGORY_EMOJI[post.category] : '🌳'}</p>
				<!-- Category tag (when no thumbnail carried it) -->
				{#if post.category}
					<span
						class="rounded-lg px-1.5 py-0.5 text-xxs font-normal tracking-wider uppercase {CATEGORY_COLOR[
							post.category
						]}"
					>
						{categoryLabel(post.category)}
					</span>
				{/if}
			</span>
		</div>

		{#if post.body}
			<!-- Three body tiers: compact card = one truncated line, feed card =
			     7-line clamp (the detail page has the rest), detail = everything. -->
			{#if compact}
				<p class="truncate font-oswald text-[0.95rem] tracking-wide text-olf-darkbrown/90">
					{post.body}
				</p>
			{:else if fullBody}
				<p class="font-oswald text-[0.95rem] tracking-wide text-olf-darkbrown/90">
					{post.body}
				</p>
			{:else}
				<p class="line-clamp-7 font-oswald text-[0.95rem] tracking-wide text-olf-darkbrown/90">
					{post.body}
				</p>
			{/if}
		{/if}
	</div>

	{#if thumb}
		<!-- The image itself is the expand control (tap to grow/shrink); the corner
		     icon just reflects the current state. -->
		<div
			bind:clientWidth={boxW}
			role="button"
			tabindex="0"
			aria-label={expanded ? m.posts_image_collapse() : m.posts_image_expand()}
			onclick={() => (expanded = !expanded)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					expanded = !expanded;
				}
			}}
			class="relative w-full overflow-hidden bg-olf-lightbrown transition-[height] duration-300 ease-out motion-reduce:transition-none {expanded
				? 'cursor-zoom-out'
				: 'cursor-zoom-in'}"
			style="height: {boxH}px"
		>
			<img
				src={thumb.url}
				alt={post.title}
				onload={onImgLoad}
				class="h-full w-full object-cover"
				loading="lazy"
			/>
			{#if !post.moderated}
				<span
					class="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 font-oswald text-xxs font-bold tracking-widest text-white uppercase"
				>
					{m.posts_unmoderated()}
				</span>
			{/if}
			<!-- State indicator — reacts to `expanded`, driven by the image tap above. -->
			<span
				aria-hidden="true"
				class="pointer-events-none absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
			>
				{#if expanded}
					<Minimize2 size={15} />
				{:else}
					<Maximize2 size={15} />
				{/if}
			</span>
		</div>
	{/if}
	<div class="flex items-center justify-between bg-olf-darkgreen px-3 py-1.5 text-white">
		<span class="flex min-w-0 items-center gap-3 font-oswald text-xs text-olf-eggshell">
			<a
				href="/posts/{post.id}"
				aria-label={m.posts_comments_heading()}
				class="flex shrink-0 items-center gap-2 transition-transform hover:scale-110"
			>
				<MessageSquare size={18} class="text-white" />
				<span class="tabular-nums">{commentCount}</span>
			</a>
			<!-- Gift an award — lives with the comment count on the left; the votes
			     keep the right side to themselves. Received awards render
			     Reddit-style right next to it: tiny overlapping icons of the top
			     types + the total gifted count; tapping the stack opens the
			     who-gifted-this modal. Signed-out viewers get NO gift icon, and
			     tapping the stack bounces them to login (the list is auth-gated). -->
			{#snippet awardIcons()}
				<span class="flex items-center -space-x-2">
					{#each topAwards as a (a.awardTypeId)}
						{#if brokenArt[a.assetKey]}
							<span class="text-[11px] leading-none">🏅</span>
						{:else}
							<img
								src={asset(`${a.assetKey}.webp`)}
								alt={a.name}
								onerror={() => (brokenArt[a.assetKey] = true)}
								class="h-4 w-4 shrink-0 rounded-full bg-olf-eggshell/90 object-contain p-px"
							/>
						{/if}
					{/each}
				</span>
				<span class="tabular-nums">{totalAwards}</span>
			{/snippet}
			{#if signedIn}
				<button
					type="button"
					onclick={openGift}
					aria-label={m.award_modal_title()}
					title={m.award_modal_title()}
					class="flex items-center transition-transform hover:scale-110"
				>
					<Gift size={17} class="text-white" />
				</button>
			{/if}
			{#if totalAwards > 0}
				<!-- The stack itself opens "who gifted this?" -->
				<button
					type="button"
					onclick={openGranters}
					aria-label={m.granters_title()}
					title={awardsTitle}
					class="flex items-center gap-1 transition-transform hover:scale-110"
				>
					{@render awardIcons()}
				</button>
			{/if}
		</span>
		<span class="flex shrink-0 items-center gap-2.5 font-oswald text-xs text-olf-eggshell">
			<button
				type="button"
				onclick={() => vote('UP')}
				disabled={voting}
				aria-pressed={myVote === 'UP'}
				aria-label={m.posts_upvote()}
				class="transition-transform hover:scale-115 disabled:opacity-60"
			>
				<ArrowBigUp
					size={20}
					class={myVote === 'UP' ? 'fill-olf-lightgreen text-olf-lightgreen' : 'text-white'}
				/>
			</button>
			<span class="tabular-nums">{net}</span>
			<button
				type="button"
				onclick={() => vote('DOWN')}
				disabled={voting}
				aria-pressed={myVote === 'DOWN'}
				aria-label={m.posts_downvote()}
				class="transition-transform hover:scale-115 disabled:opacity-60"
			>
				<ArrowBigDown
					size={20}
					class={myVote === 'DOWN' ? 'fill-olf-yolk text-olf-yolk' : 'text-white'}
				/>
			</button>
		</span>
	</div>

	<!-- Origin line: place label on the left (coarse town/city, reverse-geocoded
	     once at creation — never a precise address); distance on the right,
	     shown only when the viewer's location is known. Each is its own element
	     so they can be styled independently. Hidden when neither exists. -->
	{#if post.locationName || kmAway != null}
		<div
			class="flex items-center gap-1 bg-olf-darkgreen bg-linear-to-r from-olf-moss to-olf-darkgreen px-3 py-1 font-caveat text-sm text-olf-eggshell/90"
		>
			{#if post.locationName}
				<MapPin size={12} class="shrink-0" />
				<span class="truncate tracking-wider">{post.locationName}</span>
			{/if}
			{#if kmAway != null}
				<span class="ml-auto shrink-0 tracking-wider">
					{m.posts_distance({ km: kmAway })}
				</span>
			{/if}
		</div>
	{/if}
</article>

{#if giftOpen}
	<AwardModal bind:open={giftOpen} targetId={post.id} {onGranted} />
{/if}
{#if grantersOpen}
	<AwardGrantersModal
		bind:open={grantersOpen}
		targetId={post.id}
		{awards}
		recipientUsername={post.author.username}
	/>
{/if}

<style>
	/* UNMODERATED posts get a foil shimmer — rare collectibles, per the brand. */
	.shiny {
		background-image: linear-gradient(
			115deg,
			#f3e4c9 0%,
			#fff6e0 25%,
			#cfe08f 50%,
			#fff6e0 75%,
			#f3e4c9 100%
		);
	}
</style>
