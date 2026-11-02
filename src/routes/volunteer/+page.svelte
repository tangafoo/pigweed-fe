<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Tooltip from '$lib/components/ui/Tooltip.svelte';
	import { asset } from '$lib/config/assets';
	import { onMount } from 'svelte';
	import { mountAniCursor } from '$lib/utils/pageCursor';
	import {
		ArrowRight,
		ChevronDown,
		CloudLightning,
		CloudRainWind,
		Haze,
		House,
		Sun,
		UserRound,
		X
	} from '@lucide/svelte';
	import { fade, slide } from 'svelte/transition';
	import { SEASON_BADGE, currentSeason, seasonLabel, type Season } from '$lib/data/seasons';
	import { addMonthsYmd, farmToday, formatFarmDate, formatYmd } from '$lib/utils/date';
	import AvailabilityCalendar from '$lib/components/volunteer/AvailabilityCalendar.svelte';
	import { PEOPLE, type Person } from '$lib/data/people';
	import { projectCount } from '$lib/data/projects';

	const today = farmToday();
	// Northeast Monsoon: steady rain; inter-monsoon: afternoon thunderstorms.
	const SEASON_ICON = {
		NE_MONSOON: CloudRainWind,
		INTER_MONSOON: CloudLightning,
		SW_MONSOON: Sun,
		HAZE: Haze
	} satisfies Record<Season, unknown>;

	// Everyone with a specialization, in the order the load shuffled them.
	let { data } = $props();
	const byId = new Map<string, Person>(Object.values(PEOPLE).map((p) => [p.id, p]));
	const people = $derived(data.peopleOrder.map((id) => byId.get(id)!));

	// One modal for both a person and the general "Volunteer" enquiry: a native
	// <dialog> (focus trap + Esc for free), driven by `selected`. `shown` keeps
	// the last content rendered while it fades out.
	type Target = Person | 'general';
	let dialog = $state<HTMLDialogElement>();
	let selected = $state.raw<Target | null>(null);
	let shown = $state.raw<Target | null>(null);
	$effect(() => {
		if (!dialog) return;
		if (selected) {
			shown = selected;
			if (!dialog.open) dialog.showModal();
		} else if (dialog.open) dialog.close();
	});

	// Per person (by id): whether their "Request contact" form is open and
	// what's been typed, so switching people never resets either. The email
	// is the visitor's own, so it's shared.
	let contactOpen = $state<Record<string, boolean>>({});
	let contactMessage = $state<Record<string, string>>({});
	let contactEmail = $state('');
	// Each form's preferred date follows the calendar's pick until that form's
	// own date field is changed (then it keeps its own).
	let contactDate = $state<Record<string, string>>({});

	// The day picked on the Availability calendar (null = none). Picking one
	// pre-fills every form's date and turns the Volunteer button bluey.
	let pickedDate = $state<string | null>(null);
	const maxDate = addMonthsYmd(today, 3);

	// A click on nothing in particular (not a control, not the calendar card,
	// not the modal) unpicks the day, like clicking outside a Projects card
	// collapses it. Selecting text doesn't count.
	function unpickOnOutsideClick(e: MouseEvent) {
		if (!pickedDate || dialog?.open) return;
		const hit = (e.target as Element).closest(
			'button, a, input, textarea, select, label, dialog, [data-calendar]'
		);
		if (hit || window.getSelection()?.toString()) return;
		pickedDate = null;
	}

	const PILL =
		'inline-flex items-center gap-2 rounded-full px-5 py-2 text-lg font-bold text-olf-eggshell shadow-md transition-colors duration-200 hover:bg-olf-eggshell hover:text-olf-darkbrown';
	const FIELD =
		'w-full rounded-xl border-0 bg-white/90 px-4 py-2.5 font-oswald text-base text-olf-darkgreen placeholder:text-olf-darkgreen/50 focus:ring-2 focus:ring-olf-yolk';

	const BROWN_WASH = 'color-mix(in srgb, var(--color-olf-darkbrown) 50%, transparent)';

	// Wind: the pixel farm sits behind an SVG displacement filter. Its noise is
	// stretched sideways (low x frequency, higher y), so whole rows of pixels
	// shift left/right together, and only sideways (see the colour matrix). It
	// blows as one slow gust every 10s: ~3s of near calm, then the sway swells
	// (scale 6 → 70; the noise sits near mid-grey, so that's roughly ±10px of
	// real shift) and dies back down, while the noise
	// drifts so the bands travel. Shaped like a real gust: it arrives fast and
	// settles into its peak (ease-out), sags a little while it holds, then
	// dies away with a long, soft tail. Both <animate>s share GUST so the
	// strength and the drift stay in step. Only switched on without reduced motion; the
	// faint ripple stays, frozen, either way.
	const GUST = {
		dur: '10s',
		repeatCount: 'indefinite',
		// calm hold · arrive (ease-out) · sag (sine) · fade (long ease-out tail)
		keyTimes: '0;0.3;0.48;0.6;1',
		calcMode: 'spline',
		keySplines: '0 0 1 1;0.25 0.1 0.25 1;0.45 0 0.55 1;0.35 0 0.15 1'
	};
	let windy = $state(false);
	onMount(() => {
		windy = !matchMedia('(prefers-reduced-motion: reduce)').matches;
	});

	// Animated horse cursor while on Volunteer. Its own click point is already
	// its centre, so it's kept as is.
	onMount(() => mountAniCursor('/cursors/horse.ani'));
</script>

<svelte:document onclick={unpickOnOutsideClick} />

<Seo title={m.nav_volunteer()} description="Volunteer at Our Little Farm." noindex />

<svg width="0" height="0" class="absolute" aria-hidden="true">
	<filter id="volunteer-wind" x="0" y="0" width="100%" height="100%">
		<feTurbulence type="fractalNoise" baseFrequency="0.002 0.02" numOctaves="1" seed="4">
			{#if windy}
				<animate
					attributeName="baseFrequency"
					values="0.002 0.02;0.002 0.02;0.0023 0.0222;0.0025 0.024;0.002 0.02"
					{...GUST}
				/>
			{/if}
		</feTurbulence>
		<!-- Pin green to a flat 0.5 (= no shift) so the y displacement is zero:
		     rows only sway sideways. Any vertical push reads as goosebumps. -->
		<feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0.5  0 0 1 0 0  0 0 0 0 1" />
		<feDisplacementMap in="SourceGraphic" scale="6" xChannelSelector="R" yChannelSelector="G">
			{#if windy}
				<animate attributeName="scale" values="6;6;70;58;6" {...GUST} />
			{/if}
		</feDisplacementMap>
	</filter>
</svg>

<!-- At least as tall as the image's own 735:414 shape, so `cover` shows the
     whole farm (sky included) instead of zooming in on a wide, short strip. -->
<div class="relative isolate min-h-[calc(100vw*414/735)] flex-1 overflow-hidden px-4 py-10 md:px-8">
	<!-- Bleeds 16px past every edge so the displacement never pulls in empty
	     space at the sides. Smooth scaling, not pixelated: the source is soft and
	     only 735px wide, so nearest-neighbour at a ~2x non-integer scale just
	     gives uneven blocks. -->
	<div
		aria-hidden="true"
		style:background-image="url({asset('volunteer-pixel-farm.webp')})"
		class="pixel-farm settle absolute -inset-4 -z-10 bg-olf-sage bg-cover bg-bottom"
	></div>
	<div class="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
		<section>
			<!-- Today on the farm: the season badge, then the date. The badge starts
			     from MetMalaysia's monsoon phase and switches to Haze if the live
			     air-quality reading (streamed in) is unhealthy. -->
			<div class="deal mb-5" style:--i={0}>
				{#await data.airQuality}
					{@render seasonBadge(currentSeason(today, null))}
				{:then api}
					{@render seasonBadge(currentSeason(today, api), api)}
				{/await}
				<p class="mt-2 font-oswald text-4xl font-bold text-white drop-shadow-md">
					{formatFarmDate()}
				</p>
			</div>
			<div class="deal self-start rounded-2xl bg-white/40 p-6 backdrop-blur-md" style:--i={0}>
				<h1 class="font-oswald text-3xl font-bold text-olf-darkgreen">{m.nav_volunteer()}</h1>
				<p class="mt-3 font-mono text-sm font-light tracking-wider text-olf-darkgreen">
					AVAILABILITY
				</p>
				<!-- Solid card so the calendar reads clearly over the frosted panel. -->
				<div data-calendar class="mt-3 rounded-xl bg-olf-eggshell p-4 shadow-md">
					<AvailabilityCalendar bind:value={pickedDate} {today} />
				</div>
			</div>
		</section>
		<!-- Woodgrain under a 50% brown wash so the light grain doesn't wash out
	     the text (the brown also shows while the image loads). The wood layer
	     is 90% opaque over a backdrop blur, so a sliver of the blurred pixel
	     farm shows through. -->
		<section
			style:--i={1}
			class="deal relative isolate self-end overflow-hidden rounded-xl p-6 font-oswald text-olf-eggshell shadow-2xl backdrop-blur-md"
		>
			<div
				aria-hidden="true"
				style:background-image="linear-gradient({BROWN_WASH}, {BROWN_WASH}), url({asset(
					'woodgrain-01.webp'
				)})"
				class="absolute inset-0 -z-10 bg-olf-darkbrown bg-cover bg-center opacity-90"
			></div>
			<p class="flex items-center gap-2 text-2xl font-bold">
				The farm
				<House size={24} aria-hidden="true" />
			</p>
			<!-- Black only behind the text: an inline span, cloned per wrapped line.
			     Oswald's glyph box is ~1.44em, so 0.1em top/bottom padding (1.64em)
			     slightly overfills the 1.6 line height: the lines touch, no gaps. -->
			<p class="mt-4 text-lg leading-[1.6]">
				<span class="bg-black box-decoration-clone px-1 py-[0.1em]">
					We've got tons of projects going on at any time. The guys specialize in different areas,
					and always welcome a helping hand.
				</span>
			</p>
			<!-- People with a specialization, shuffled per load. Rows are a fixed h-14, so
			     the list shows 5 before it scrolls. -->
			<!-- Faint tray; the list inside keeps its own 5-row max-h. Side inset is
			     tray 0.3625rem + row 0.5rem = 13.8px (15% over the old 12px). No
			     backdrop blur of its own: it sat inside the card's backdrop blur, over
			     the wind-animated background, and nested backdrop filters re-sample
			     every frame, so hovering a row flickered. The card's wood is 90%
			     opaque anyway, so there was nothing to blur. -->
			<div class="mt-4 rounded-xl bg-olf-eggshell/10 px-[0.3625rem] py-1 shadow-md">
				<ul class="max-h-70 overflow-x-hidden overflow-y-auto">
					{#each people as p, i (p.id)}
						<li class="rise" style:--i={i}>
							<button
								type="button"
								onclick={() => (selected = p)}
								class="flex h-14 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors duration-200 hover:bg-olf-bluey"
							>
								<span class="flex min-w-0 items-center gap-2">
									<span
										class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-olf-lightcoral text-olf-darkbrown shadow-md"
									>
										{#if p.imageUrl}
											<img src={p.imageUrl} alt="" class="size-full object-cover" />
										{:else}
											<UserRound size={16} />
										{/if}
									</span>
									<!-- Name, with what they specialize in underneath (Volunteer page only). -->
									<span class="flex min-w-0 flex-col leading-tight">
										<span class="truncate text-lg">{p.name}</span>
										{#if p.specializations?.length}
											<span class="truncate font-mono text-xs text-olf-eggshell/70">
												{p.specializations.join(' · ')}
											</span>
										{/if}
									</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>

			<p class="mt-4 font-mono text-sm leading-[1.6]">
				Choose a specific person you'd like to work with volunteering at the farm, or send us a
				general enquiry here.
			</p>
			<button
				type="button"
				onclick={() => (selected = 'general')}
				class="{PILL} mt-4 {pickedDate ? 'bg-olf-bluey' : 'bg-olf-yolk'}"
			>
				{m.nav_volunteer()}
				<ArrowRight size={18} />
			</button>
		</section>
	</div>
</div>

{#snippet seasonBadge(season: Season, api: number | null = null)}
	<!-- Keyed so a change (e.g. to Haze once the reading arrives) fades over. -->
	{#key season}
		{@const Icon = SEASON_ICON[season]}
		{#snippet badge()}
			<span
				class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-oswald text-sm font-bold tracking-wide text-olf-eggshell uppercase shadow-md {SEASON_BADGE[
					season
				]}"
			>
				<Icon size={16} strokeWidth={2.5} aria-hidden="true" />
				{seasonLabel(season)}
			</span>
		{/snippet}
		<span in:fade={{ duration: 200 }} class="inline-flex">
			<!-- The live air-quality reading behind a Haze badge, on hover. -->
			{#if api === null}
				{@render badge()}
			{:else}
				<Tooltip text="API {api} (Nilai)" mono>{@render badge()}</Tooltip>
			{/if}
		</span>
	{/key}
{/snippet}

{#snippet closeButton()}
	<button
		type="button"
		onclick={() => (selected = null)}
		aria-label={m.farmdex_close()}
		class="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-olf-eggshell/10 hover:bg-olf-eggshell/20"
	>
		<X size={20} />
	</button>
{/snippet}

<!-- Contact request form: UI only for now (not sent anywhere yet). `key` is
     whose message it is (a person's id, or 'general'). -->
{#snippet contactForm(key: string, placeholder: string)}
	{@const formDate = contactDate[key] ?? pickedDate}
	<form onsubmit={(e) => e.preventDefault()} class="flex w-full max-w-md flex-col gap-3 pt-1">
		<input
			type="email"
			bind:value={contactEmail}
			placeholder={m.volunteer_email_placeholder()}
			autocomplete="email"
			class={FIELD}
		/>
		<label class="flex flex-col gap-1 text-left">
			<span class="font-mono text-xs tracking-wider text-olf-eggshell/70 uppercase">
				{m.volunteer_preferred_date()}
			</span>
			<!-- The native date field can't show a weekday, so it's overlaid on the
			     right, just left of the browser's calendar icon. -->
			<span class="relative">
				<input
					type="date"
					min={today}
					max={maxDate}
					bind:value={() => contactDate[key] ?? pickedDate ?? '', (v) => (contactDate[key] = v)}
					class={FIELD}
				/>
				{#if formDate}
					<span
						class="pointer-events-none absolute inset-y-0 right-12 flex items-center font-oswald text-base text-olf-darkgreen/60"
					>
						{formatYmd(formDate, { weekday: 'long' })}
					</span>
				{/if}
			</span>
		</label>
		<textarea
			bind:value={() => contactMessage[key] ?? '', (v) => (contactMessage[key] = v)}
			{placeholder}
			rows="4"
			class="{FIELD} resize-none"
		></textarea>
		<button type="submit" class="{PILL} self-end bg-olf-yolk">
			{m.volunteer_send()}
		</button>
	</form>
{/snippet}

<!-- Simple modal: heavy blur + black wash over the page, the content centred
     on it. Click outside the content (or Esc) closes. -->
<dialog
	bind:this={dialog}
	onclose={() => (selected = null)}
	onclick={(e) => {
		if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.stage != null)
			selected = null;
	}}
	class="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 font-oswald text-olf-eggshell backdrop:bg-black/60 backdrop:backdrop-blur-xl"
>
	{#if shown === 'general'}
		<div data-stage class="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
			{@render closeButton()}
			<h2 class="text-4xl font-bold">{m.nav_volunteer()}</h2>
			{@render contactForm('general', m.volunteer_interest_placeholder())}
		</div>
	{:else if shown}
		{@const id = shown.id}
		<!-- Keyed per person: switching people swaps the content outright, so one
		     person's open form never plays its collapse into the next person. -->
		{#key id}
			<div
				data-stage
				class="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"
			>
				{@render closeButton()}
				<span
					class="flex size-28 items-center justify-center overflow-hidden rounded-full bg-olf-lightcoral text-olf-darkbrown shadow-lg transition-transform duration-200 ease-out hover:scale-120"
				>
					{#if shown.imageUrl}
						<img src={shown.imageUrl} alt="" class="size-full object-cover" />
					{:else}
						<UserRound size={48} />
					{/if}
				</span>
				<h2 class="text-4xl font-bold">{shown.name}</h2>
				{#if shown.specializations?.length}
					<p class="font-mono text-sm text-olf-eggshell/70">{shown.specializations.join(' · ')}</p>
				{/if}
				<div class="mt-2 flex flex-wrap items-center justify-center gap-3">
					<!-- Only for people on a project (nothing to see otherwise). -->
					{#if projectCount(shown)}
						<a href="/projects?person={shown.id}" class="{PILL} bg-olf-yolk">
							{m.volunteer_view_work({ name: shown.name })}
							<ArrowRight size={18} />
						</a>
					{/if}
					<button
						type="button"
						onclick={() => (contactOpen[id] = !contactOpen[id])}
						aria-expanded={!!contactOpen[id]}
						class="{PILL} bg-olf-eggshell/15"
					>
						{m.volunteer_request_contact()}
						<ChevronDown
							size={18}
							class="transition-transform duration-200 {contactOpen[id] ? 'rotate-180' : ''}"
						/>
					</button>
				</div>
				{#if contactOpen[id]}
					<div transition:slide={{ duration: 200 }} class="flex w-full justify-center">
						{@render contactForm(id, m.volunteer_interest_with_placeholder({ name: shown.name }))}
					</div>
				{/if}
			</div>
		{/key}
	{/if}
</dialog>

<style>
	/* Page-load intro (CSS, so it plays on the SSR'd page too): the farm
	   settles in from a slight zoom, then the two sections are dealt in like
	   the Projects cards, then the people rows rise like its board. */
	@media (prefers-reduced-motion: no-preference) {
		.settle {
			animation: settle-in 700ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
		}
		.deal {
			animation: deal-in 450ms cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
			animation-delay: calc(150ms + var(--i) * 80ms);
		}
		.rise {
			animation: rise-in 220ms cubic-bezier(0.65, 0, 0.35, 1) backwards;
			animation-delay: calc(450ms + min(var(--i), 12) * 25ms);
		}
	}
	@keyframes settle-in {
		from {
			opacity: 0;
			scale: 1.06;
		}
	}
	@keyframes deal-in {
		from {
			opacity: 0;
			translate: 0 64px;
			rotate: -3deg;
		}
	}
	@keyframes rise-in {
		from {
			opacity: 0;
			translate: 0 24px;
		}
	}
	/* Fade the dialog and its blur in/out (native-<dialog> pattern, as in
	   FarmdexModal); the content rises a touch. */
	dialog,
	dialog::backdrop {
		opacity: 0;
		transition:
			opacity 0.2s ease,
			overlay 0.2s ease allow-discrete,
			display 0.2s ease allow-discrete;
	}
	dialog[open],
	dialog[open]::backdrop {
		opacity: 1;
	}
	@starting-style {
		dialog[open],
		dialog[open]::backdrop {
			opacity: 0;
		}
	}
	dialog [data-stage] {
		transition: translate 0.2s ease;
	}
	dialog:not([open]) [data-stage] {
		translate: 0 8px;
	}
	@starting-style {
		dialog[open] [data-stage] {
			translate: 0 8px;
		}
	}
	.pixel-farm {
		filter: url(#volunteer-wind);
	}
</style>
