<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import Seo from '$lib/components/seo/Seo.svelte';
	import ProjectCard from '$lib/components/projects/ProjectCard.svelte';
	import { PEOPLE, PROJECTS, type Person, type Project } from '$lib/data/projects';
	import { onMount, tick } from 'svelte';
	import { trackPeopleBoard } from '$lib/utils/peopleBoard';
	import { UserRound } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import { asset } from '$lib/config/assets';

	// Expanded cards, latest first. On desktop they stack full-width at the top
	// (via CSS order) above the grid of succinct cards.
	// Raw so the array holds the original objects (a deep $state proxy would
	// wrap them and break includes/indexOf).
	let expanded = $state.raw<Project[]>([]);

	function setExpanded(project: Project, value: boolean) {
		const rest = expanded.filter((p) => p !== project);
		expanded = value ? [project, ...rest] : rest;
	}

	// People filter (desktop left column): only projects that person worked on.
	// Order comes from the load (permanent shuffled, then helpers); only people
	// with at least one project are listed.
	let { data } = $props();
	const byId = new Map<string, Person>(Object.values(PEOPLE).map((p) => [p.id, p]));
	const people = $derived(
		data.peopleOrder
			.map((id) => byId.get(id)!)
			.filter((p) => PROJECTS.some((x) => x.people.includes(p)))
	);
	let person = $state.raw<Person | null>(null);
	const visible = $derived(person ? PROJECTS.filter((p) => p.people.includes(person!)) : PROJECTS);
	// Only expanded cards that are on screen count (header size, solo collapse).
	const shownExpanded = $derived(expanded.filter((p) => visible.includes(p)));

	// Page-load intro (CSS, so it plays on the SSR'd page too): cards deal in
	// (ProjectCard), board rows rise like the Farmdex index. Switched off once
	// it has played, so cards that mount later (filtering) get none: the view
	// transition moves those.
	let intro = $state(true);
	onMount(() => {
		const t = setTimeout(() => (intro = false), 450 + PROJECTS.length * 80);
		return () => clearTimeout(t);
	});

	// Board background: woodgrain under a 60% beige wash (= woodgrain at 40%
	// over beige). Fixed size, pinned to the top (not cover): the grain
	// mustn't rescale when the board changes height mid-animation.
	const BEIGE_WASH = 'color-mix(in srgb, var(--color-olf-beige) 60%, transparent)';

	const FILTER =
		'group relative flex w-full cursor-pointer items-center gap-2 p-1 pr-2 text-left transition-colors duration-200 aria-pressed:text-olf-eggshell';
	// Highlighted row's background tilts a hair left or right, picked at random
	// on each selection (same as the Farmdex index).
	let tilt = $state<'left' | 'right'>('left');

	// Same view transition as expand/collapse, so cards slide to their new spots
	// (numbers fade out first: data-project-transition, see ProjectCard).
	// Cards dropping out pop away and new ones are dealt in (CSS below): they're
	// tagged before the old snapshot (leaving) and with the new state (entering).
	// The filter board is desktop-only, so avatar clicks filter only there (on a
	// phone there'd be no way to clear it).
	const isDesktop = () => matchMedia('(min-width: 768px)').matches;

	// `toggle`: the board buttons clear the filter when clicked again; an avatar
	// click in a card always applies it.
	async function setPerson(next: Person | null, toggle = true) {
		if (next === highlighted) {
			if (!toggle) return;
			next = null;
		}
		tilt = Math.random() < 0.5 ? 'left' : 'right';
		// The board highlight answers the click right away (live, outside the
		// card swap); the cards follow in the view transition.
		highlighted = next;
		const root = document.documentElement;
		if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
			person = next;
			return;
		}
		const before = visible;
		const after = next ? PROJECTS.filter((p) => p.people.includes(next!)) : PROJECTS;
		leaving = before.filter((p) => !after.includes(p));
		// No wait for the numbers to fade (unlike expand): cards keep their size
		// here, so the numbers just hide while they move and fade back after.
		root.dataset.projectTransition = 'filter';
		await tick();
		const boardMoved = trackPeopleBoard();
		document
			.startViewTransition(async () => {
				leaving = [];
				entering = after.filter((p) => !before.includes(p));
				person = next;
				await tick();
				boardMoved();
			})
			.finished.finally(() => {
				entering = [];
				delete root.dataset.projectTransition;
				delete root.dataset.peopleBoard;
			});
	}
	let highlighted = $state.raw<Person | null>(null);
	let leaving = $state.raw<Project[]>([]);
	let entering = $state.raw<Project[]>([]);

	// Header "Close all" (any card open): same collapse animation as one card's
	// minimize, minus the clicked card's hang-and-drop.
	async function closeAll() {
		const root = document.documentElement;
		if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
			expanded = [];
			return;
		}
		root.dataset.projectTransition = 'collapse';
		await new Promise((r) => setTimeout(r, 120));
		const boardMoved = trackPeopleBoard();
		document
			.startViewTransition(async () => {
				expanded = [];
				await tick();
				boardMoved();
			})
			.finished.finally(() => {
				delete root.dataset.projectTransition;
				delete root.dataset.peopleBoard;
			});
	}
</script>

<Seo title={m.nav_projects()} description="Projects at Our Little Farm." noindex />

<div class="flex flex-1 flex-col bg-olf-sunfadedsage px-4 py-10">
	<div class="flex flex-1 flex-col">
		<!-- Header with a woodgrain background, edge to edge (-mx-4 / -mt-10 cancel
		     the page padding). Set its height with the h-* class; that's the only knob.
		     The photo is rotated 90°, so it can't be a CSS background: it's an
		     absolute layer sized the other way round (height = header width,
		     width = header height, via container units) and centred before turning.
		     No padding on the header: container units measure inside the padding. -->
		<!-- While any card is expanded it halves (height and title) to make room.
		     It's NOT in the cards' view transition: the page behind them is shown
		     live, so these plain CSS transitions play while the cards move. -->
		<header
			class="@container-size relative -mx-4 -mt-10 mb-8 flex items-center justify-center overflow-hidden transition-[height] duration-350 ease-in {shownExpanded.length
				? 'h-12.5'
				: 'h-20'}"
		>
			<img
				src={asset('woodgrain-02.webp')}
				alt=""
				class="absolute top-1/2 left-1/2 h-[100cqw] w-[100cqh] max-w-none -translate-1/2 rotate-90 object-fill"
			/>
			<h1
				class="relative w-fit font-frijole text-3xl font-bold tracking-widest text-olf-eggshell shadow-lg transition-[scale] duration-350 ease-in {shownExpanded.length
					? 'scale-50'
					: ''}"
			>
				{m.nav_projects()}
			</h1>
			{#if shownExpanded.length}
				<button
					type="button"
					onclick={closeAll}
					transition:fly={{ x: 12, duration: 200 }}
					class="absolute right-6 cursor-pointer rounded-full bg-olf-beige px-3 py-1 font-oswald text-sm tracking-wide text-olf-darkgreen shadow-md transition-colors duration-200 hover:bg-olf-eggshell"
				>
					{m.projects_close_all()}
				</button>
			{/if}
		</header>
		<div class="flex flex-1">
			<!-- Left (desktop): people filter, like the Farmdex index column, as a
			     square-cornered beige board inset by the page padding, full height of
			     the row. Click a person to show only their projects; again to clear
			     (nothing selected = all). -->
			<aside
				style:view-transition-name="projects-people"
				data-people-board
				style:background-image="linear-gradient({BEIGE_WASH}, {BEIGE_WASH}), url({asset(
					'woodgrain-03.webp'
				)})"
				class="hidden w-44 shrink-0 border border-olf-darkgreen/20 bg-olf-beige bg-[length:auto_800px] bg-top bg-repeat-y p-4 shadow-lg md:block"
			>
				<h2
					class="mb-2 border-b border-olf-darkgreen/20 pb-2 font-oswald text-sm tracking-wide text-olf-darkgreen/60 uppercase"
				>
					{m.projects_people()}
				</h2>
				<ul class="flex flex-col gap-1 font-oswald text-sm text-olf-darkgreen">
					{#each people as p, i (p.id)}
						<li class={intro ? 'rise' : ''} style:--i={i}>
							<button
								type="button"
								onclick={() => setPerson(p)}
								aria-pressed={highlighted === p}
								class={FILTER}
							>
								<!-- Background layer only — tilts on select; avatar + name stay level. -->
								<span
									aria-hidden="true"
									class="absolute inset-0 rounded-xl transition-[background-color,rotate] duration-200 ease-out group-hover:bg-olf-darkgreen/10 group-aria-pressed:bg-olf-yolk {highlighted ===
									p
										? tilt === 'left'
											? '-rotate-2'
											: 'rotate-2'
										: ''}"
								></span>
								<span
									class="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-olf-lightcoral text-olf-darkbrown shadow-md"
								>
									{#if p.imageUrl}
										<img src={p.imageUrl} alt="" class="size-full object-cover" />
									{:else}
										<UserRound size={16} />
									{/if}
								</span>
								<span class="relative truncate">{p.name}</span>
								<span
									class="relative ml-auto font-mono text-xs font-light text-olf-darkgreen/60 transition-colors duration-200 group-aria-pressed:text-olf-eggshell/80"
								>
									{PROJECTS.filter((x) => x.people.includes(p)).length}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			</aside>

			<!-- Desktop: equal-width succinct cards; expanded cards span the row and
			     sit on top. Expanded orders are negative so they come before the grid. -->
			<div
				class="grid flex-1 content-start gap-8 md:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] md:gap-x-14 md:px-20"
			>
				{#each visible as project, i (project)}
					<ProjectCard
						{project}
						expanded={expanded.includes(project)}
						solo={shownExpanded.length === 1 && shownExpanded[0] === project}
						order={shownExpanded.indexOf(project) - shownExpanded.length}
						deal={intro ? i : null}
						filterRole={leaving.includes(project)
							? 'leaving'
							: entering.includes(project)
								? 'entering'
								: null}
						onexpandedchange={(v) => setExpanded(project, v)}
						onpersonclick={(x) => isDesktop() && setPerson(x, false)}
					/>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	/* Board rows rise into place on load (Farmdex index timing, no fade). */
	@media (prefers-reduced-motion: no-preference) {
		.rise {
			animation: rise-in 220ms cubic-bezier(0.65, 0, 0.35, 1) backwards;
			animation-delay: calc(min(var(--i), 12) * 25ms);
		}
	}
	@keyframes rise-in {
		from {
			translate: 0 24px;
		}
	}
	/* Filter: cards dropping out pop away (scale to nothing with a little
	   spin); arriving cards are dealt in like the page-load intro, just after.
	   These groups have only one snapshot, so the browser gives them no
	   animation of its own; the individual translate/rotate/scale properties
	   compose with the group's positioning transform. Unclipped so the deal
	   can rise from below its box. */
	:global(::view-transition-image-pair(*.entering)),
	:global(::view-transition-image-pair(*.leaving)) {
		overflow: visible;
	}
	:global(:root::view-transition-old(*.leaving)) {
		display: block;
	}
	:global(::view-transition-group(*.leaving)) {
		animation: filter-out 220ms cubic-bezier(0.55, 0, 1, 0.45) forwards;
	}
	:global(::view-transition-group(*.entering)) {
		animation: filter-in 450ms cubic-bezier(0.34, 1.56, 0.64, 1) 60ms backwards;
	}
	@keyframes -global-filter-out {
		to {
			scale: 0;
			rotate: 8deg;
		}
	}
	@keyframes -global-filter-in {
		from {
			translate: 0 64px;
			rotate: -4deg;
			scale: 0.6;
		}
	}

	/* The people board stretches with the row, so expanding/collapsing a card
	   changes its height. It joins the cards' view transition: both snapshots
	   are drawn unscaled (top-left) inside a box that grows or shrinks, so the
	   board extends or retracts instead of jumping. Timing matches the cards
	   (ProjectCard): solitaire deal on expand, slow landing on collapse. */
	:global(::view-transition-group(projects-people)) {
		animation-duration: 350ms;
		animation-timing-function: cubic-bezier(0.34, 1.4, 0.64, 1);
	}
	:global(:root[data-project-transition='collapse']::view-transition-group(projects-people)) {
		animation-duration: 800ms;
		animation-timing-function: cubic-bezier(0.65, 0, 0.35, 1);
	}
	:global(::view-transition-image-pair(projects-people)) {
		overflow: clip;
	}
	:global(::view-transition-old(projects-people)),
	:global(::view-transition-new(projects-people)) {
		animation: none;
		width: 100%;
		height: auto;
		object-fit: none;
		object-position: left top;
	}
	/* Only one snapshot at a time (see utils/peopleBoard): growing shows the
	   new, taller board being uncovered; shrinking shows the old one being
	   covered. Content is top-aligned and identical, so nothing jumps. */
	:global(:root:not([data-people-board='shrink'])::view-transition-old(projects-people)),
	:global(:root[data-people-board='shrink']::view-transition-new(projects-people)) {
		display: none;
	}
</style>
