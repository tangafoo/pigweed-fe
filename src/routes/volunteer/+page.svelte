<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { asset } from '$lib/config/assets';
	import { onMount } from 'svelte';
	import { ArrowRight, ChevronDown, House, UserRound, X } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import { PEOPLE, type Person } from '$lib/data/people';
	import { projectCount } from '$lib/data/projects';

	// Everyone with a specialization, in the order the load shuffled them.
	let { data } = $props();
	const byId = new Map<string, Person>(Object.values(PEOPLE).map((p) => [p.id, p]));
	const people = $derived(data.peopleOrder.map((id) => byId.get(id)!));

	// Person modal: a native <dialog> (focus trap + Esc for free), driven by
	// `selected`. `shown` keeps the last person rendered while it fades out.
	let dialog = $state<HTMLDialogElement>();
	let selected = $state.raw<Person | null>(null);
	let shown = $state.raw<Person | null>(null);
	$effect(() => {
		if (!dialog) return;
		if (selected) {
			if (selected !== shown) contactOpen = false;
			shown = selected;
			if (!dialog.open) dialog.showModal();
		} else if (dialog.open) dialog.close();
	});

	let contactOpen = $state(false);
	let contactEmail = $state('');
	let contactMessage = $state('');

	const PILL =
		'inline-flex items-center gap-2 rounded-full px-5 py-2 text-lg font-bold text-olf-eggshell shadow-md transition-colors duration-200 hover:bg-olf-eggshell hover:text-olf-darkbrown';
	const FIELD =
		'w-full rounded-xl border-0 bg-white/90 px-4 py-2.5 font-oswald text-base text-olf-darkgreen placeholder:text-olf-darkgreen/50 focus:ring-2 focus:ring-olf-yolk';

	const BROWN_WASH = 'color-mix(in srgb, var(--color-olf-darkbrown) 50%, transparent)';

	// Wind: the pixel farm sits behind an SVG displacement filter. Its noise is
	// stretched sideways (low x frequency, higher y), so whole rows of pixels
	// shift left/right together; slowly drifting the y frequency moves those
	// bands, which reads as gusts rippling through the grass and trees. Only
	// switched on (SMIL <animate>) without reduced motion; the ripple stays,
	// frozen, either way.
	let windy = $state(false);
	onMount(() => {
		windy = !matchMedia('(prefers-reduced-motion: reduce)').matches;
	});
</script>

<Seo title={m.nav_volunteer()} description="Volunteer at Our Little Farm." noindex />

<svg width="0" height="0" class="absolute" aria-hidden="true">
	<filter id="volunteer-wind" x="0" y="0" width="100%" height="100%">
		<feTurbulence type="fractalNoise" baseFrequency="0.002 0.02" numOctaves="1" seed="4">
			{#if windy}
				<animate
					attributeName="baseFrequency"
					dur="9s"
					values="0.002 0.02;0.003 0.026;0.002 0.02"
					repeatCount="indefinite"
				/>
			{/if}
		</feTurbulence>
		<feDisplacementMap in="SourceGraphic" scale="6" xChannelSelector="R" yChannelSelector="B" />
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
		<div class="deal self-start rounded-2xl bg-white/40 p-6 backdrop-blur-md" style:--i={0}>
			<h1 class="font-oswald text-3xl font-bold text-olf-darkgreen">{m.nav_volunteer()}</h1>
			<p class="mt-3 font-oswald text-lg text-olf-darkgreen/70">{m.volunteer_coming_soon()}</p>
		</div>
		<!-- Woodgrain under a 50% brown wash so the light grain doesn't wash out
	     the text (the brown also shows while the image loads). The wood layer
	     is 90% opaque over a backdrop blur, so a sliver of the blurred pixel
	     farm shows through. -->
		<section
			style:--i={1}
			class="deal relative isolate self-start overflow-hidden rounded-2xl p-6 font-oswald text-olf-eggshell shadow-md backdrop-blur-md"
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
			<!-- Faint frosted tray; the list inside keeps its own 5-row max-h. -->
			<div class="mt-4 rounded-xl bg-olf-eggshell/10 px-3 py-1 shadow-md backdrop-blur-sm">
				<ul class="max-h-70 overflow-y-auto">
					{#each people as p, i (p.id)}
						<li class="rise" style:--i={i}>
							<button
								type="button"
								onclick={() => (selected = p)}
								class="-mx-2 flex h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 text-left transition-colors duration-200 hover:bg-olf-eggshell/10"
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
		</section>
	</div>
</div>

<!-- Simple person modal: heavy blur + black wash over the page, the person
     centred on it. Click outside the content (or Esc) closes. -->
<dialog
	bind:this={dialog}
	onclose={() => (selected = null)}
	onclick={(e) => {
		if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.stage != null)
			selected = null;
	}}
	class="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 font-oswald text-olf-eggshell backdrop:bg-black/60 backdrop:backdrop-blur-xl"
>
	{#if shown}
		<div data-stage class="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
			<button
				type="button"
				onclick={() => (selected = null)}
				aria-label={m.farmdex_close()}
				class="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-olf-eggshell/10 hover:bg-olf-eggshell/20"
			>
				<X size={20} />
			</button>
			<span
				class="flex size-28 items-center justify-center overflow-hidden rounded-full bg-olf-lightcoral text-olf-darkbrown shadow-lg"
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
					onclick={() => (contactOpen = !contactOpen)}
					aria-expanded={contactOpen}
					class="{PILL} bg-olf-eggshell/15"
				>
					{m.volunteer_request_contact()}
					<ChevronDown
						size={18}
						class="transition-transform duration-200 {contactOpen ? 'rotate-180' : ''}"
					/>
				</button>
			</div>
			<!-- Contact request: UI only for now (not sent anywhere yet). -->
			{#if contactOpen}
				<form
					transition:slide={{ duration: 200 }}
					onsubmit={(e) => e.preventDefault()}
					class="flex w-full max-w-md flex-col gap-3 pt-1"
				>
					<input
						type="email"
						bind:value={contactEmail}
						placeholder={m.volunteer_email_placeholder()}
						autocomplete="email"
						class={FIELD}
					/>
					<textarea
						bind:value={contactMessage}
						placeholder={m.volunteer_interest_placeholder()}
						rows="4"
						class="{FIELD} resize-none"
					></textarea>
					<button type="submit" class="{PILL} self-end bg-olf-yolk">
						{m.volunteer_send()}
					</button>
				</form>
			{/if}
		</div>
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
