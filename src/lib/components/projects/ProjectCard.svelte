<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import RichText from '$lib/components/ui/RichText.svelte';
	import { Check, ChevronLeft, ChevronRight, UserRound } from '@lucide/svelte';
	import { DURATION_NOT_STARTED, DURATION_ONGOING, formatDays } from '$lib/utils/date';
	import type { Project } from '$lib/data/projects';

	let { project }: { project: Project } = $props();

	const duration = $derived(
		formatDays(project.duration) ??
			(project.duration === DURATION_ONGOING ? m.projects_ongoing() : m.projects_not_started())
	);

	// Status indicator: done = green check, ongoing = yolk pulsing dot,
	// not started = blue diamond (same mask as Farmdex reptiles).
	const done = $derived(
		project.duration !== DURATION_ONGOING && project.duration !== DURATION_NOT_STARTED
	);
	const dot = $derived(
		project.duration === DURATION_ONGOING
			? 'size-2.5 rounded-full bg-olf-yolk motion-safe:animate-pulse'
			: 'dot-diamond h-3 w-2.5 bg-olf-sunfadedblue'
	);

	// Photos are a native scroll-snap strip (swipe / trackpad work for free);
	// the arrows just scroll it, and the scroll position tracks the current
	// photo. Wraps at both ends like the Farmdex modal.
	let scroller = $state<HTMLDivElement>();
	let imageIndex = $state(0);

	function goTo(i: number) {
		if (!scroller) return;
		const n = project.imageUrls.length;
		scroller.scrollTo({ left: ((i + n) % n) * scroller.clientWidth, behavior: 'smooth' });
	}

	// Click a photo to fill the frame, zoomed toward the click point; click
	// again to see it whole. Resets when you move to another photo. object-fit
	// can't animate, so the photo stays `contain` and a transform scales it up
	// to exactly what `cover` + `object-position: <click%>` would show.
	let zoom = $state<{ i: number; transform: string } | null>(null);

	function toggleZoom(e: MouseEvent, i: number) {
		if (zoom?.i === i) {
			zoom = null;
			return;
		}
		const img = e.currentTarget as HTMLImageElement;
		const [bw, bh] = [img.clientWidth, img.clientHeight];
		const fit = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
		const [dw, dh] = [img.naturalWidth * fit, img.naturalHeight * fit]; // contained size
		const s = Math.max(bw / dw, bh / dh); // contain → cover
		const tx = (bw - s * dw) * (e.offsetX / bw) - (s * (bw - dw)) / 2;
		const ty = (bh - s * dh) * (e.offsetY / bh) - (s * (bh - dh)) / 2;
		zoom = { i, transform: `translate(${tx}px, ${ty}px) scale(${s})` };
	}

	// Same style as the Farmdex modal's photo arrows.
	const ARROW =
		'absolute top-1/2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/45';
</script>

<!-- drop-shadow (not box-shadow) so the shadow follows the tab's shape
     instead of drawing a box around the empty space beside it. -->
<article class="relative drop-shadow-md md:pl-[40%]">
	<span
		class="flex w-1/2 items-center justify-between rounded-t-lg bg-olf-darkgreen px-3 py-1 md:rounded-tl-none"
	>
		<span
			class="bg-linear-to-r from-olf-eggshell via-olf-lightgreen to-olf-eggshell bg-size-[200%] bg-clip-text text-transparent uppercase motion-safe:animate-gradient-x motion-safe:[animation-duration:6s]"
		>
			{duration}
		</span>
		{#if done}
			<Check size={16} strokeWidth={3} class="shrink-0 text-olf-sage" aria-hidden="true" />
		{:else}
			<span class="shrink-0 {dot}" aria-hidden="true"></span>
		{/if}
	</span>

	<div
		class="flex flex-col overflow-hidden rounded-tr-xl md:absolute md:inset-y-0 md:left-0 md:w-2/5 md:rounded-l-2xl md:rounded-tr-none"
	>
		<div class="relative bg-black md:min-h-0 md:flex-1">
			<div
				bind:this={scroller}
				onscroll={() => {
					if (!scroller) return;
					const i = Math.round(scroller.scrollLeft / scroller.clientWidth);
					if (i !== imageIndex) zoom = null;
					imageIndex = i;
				}}
				class="flex size-full snap-x snap-mandatory scrollbar-none overflow-x-auto"
			>
				{#each project.imageUrls as url, i (url)}
					<!-- The frame clips the scaled photo (a transform would otherwise
					     grow the strip's scroll width). -->
					<div
						class="aspect-2/1 w-full shrink-0 snap-start overflow-hidden md:aspect-auto md:h-full"
					>
						<!-- Zoom is a mouse/tap enhancement; keyboard users lose nothing. -->
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
						<img
							src={url}
							alt=""
							loading={i === 0 ? 'eager' : 'lazy'}
							onclick={(e) => toggleZoom(e, i)}
							style:transform={zoom?.i === i ? zoom.transform : undefined}
							class="size-full origin-top-left object-contain duration-200 ease-out motion-safe:transition-transform {zoom?.i ===
							i
								? 'cursor-zoom-out'
								: 'cursor-zoom-in'}"
						/>
					</div>
				{/each}
			</div>
			{#if project.imageUrls.length > 1}
				<button
					type="button"
					onclick={() => goTo(imageIndex - 1)}
					aria-label={m.farmdex_prev_image()}
					class="{ARROW} left-3"
				>
					<ChevronLeft size={22} />
				</button>
				<button
					type="button"
					onclick={() => goTo(imageIndex + 1)}
					aria-label={m.farmdex_next_image()}
					class="{ARROW} right-3"
				>
					<ChevronRight size={22} />
				</button>
			{/if}
		</div>
	</div>

	<!-- Phones: one column, people under a full-width hairline. Desktop: people
	     move to their own column on the right, behind a vertical hairline. -->
	<div
		class="flex flex-col rounded-b-2xl bg-olf-eggshell font-oswald text-olf-darkgreen md:min-h-64 md:flex-row md:rounded-tr-2xl md:rounded-bl-none"
	>
		<div class="flex flex-1 flex-col gap-4 p-6">
			<header>
				<p class="font-mono text-xs font-light tracking-widest uppercase">Project</p>
				<h2 class="text-2xl font-bold text-olf-darkbrown"><RichText text={project.title} /></h2>
				<p class="font-mono text-olf-darkbrown/80"><RichText text={project.subtitle} /></p>
			</header>

			{#each project.description as paragraph, i (i)}
				<p class="text-base leading-relaxed"><RichText text={paragraph} /></p>
			{/each}

			{#if project.toolsUsed.length}
				<div>
					<h3 class="mb-1 text-sm tracking-wide text-olf-darkgreen/60 uppercase">
						{m.projects_tools()}
					</h3>
					<ul class="flex flex-wrap gap-2">
						{#each project.toolsUsed as tool (tool.name)}
							<li class="rounded-full bg-olf-sage px-3 py-0.5 text-sm">{tool.name}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>

		{#if project.people.length}
			<div
				class="rounded-b-2xl border-t border-olf-darkgreen/20 bg-olf-cottoncandy px-6 pt-4 pb-6 md:shrink-0 md:rounded-l-none md:rounded-r-2xl md:border-t-0 md:border-l md:pt-6"
			>
				<h3 class="mb-1 text-sm tracking-wide text-olf-darkgreen/60 uppercase md:mb-2">
					{m.projects_people()}
				</h3>
				<ul class="flex flex-wrap gap-2 md:flex-col md:items-end">
					{#each project.people as person (person.id)}
						<!-- Focusable so a tap shows the name on touch screens too. -->
						<li class="group relative">
							<button
								type="button"
								aria-label={person.name}
								class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-olf-lightcoral text-olf-darkbrown outline-none focus-visible:ring-2 focus-visible:ring-olf-darkgreen"
							>
								{#if person.imageUrl}
									<img src={person.imageUrl} alt="" class="size-full object-cover" />
								{:else}
									<UserRound size={18} />
								{/if}
							</button>
							<span
								role="tooltip"
								class="pointer-events-none absolute top-full left-1/2 z-20 mt-1.5 hidden -translate-x-1/2 rounded-lg bg-olf-darkgreen px-2 py-0.5 text-sm whitespace-nowrap text-olf-eggshell shadow-md group-focus-within:block group-hover:block"
							>
								{person.name}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</article>
