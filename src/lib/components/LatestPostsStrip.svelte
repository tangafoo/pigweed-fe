<script lang="ts">
	import type { Post, Session } from '@meteorclass/pigweed-contract';
	import { m } from '$lib/paraglide/messages.js';
	import PostCard from '$lib/components/PostCard.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { asset } from '$lib/assets';
	import { ArrowRight } from '@lucide/svelte';

	interface LatestPostsStripProps {
		posts: Post[];
		session: Session | null;
	}
	let { posts, session }: LatestPostsStripProps = $props();

	// Padded to a comfortable card count (in case the feed is near-empty),
	// then doubled so the auto-scroll loops seamlessly — at half the scroll
	// width the second (identical) half is on screen, so the jump back to 0
	// is invisible.
	const filled = $derived(
		posts.length > 0 ? Array.from({ length: Math.ceil(8 / posts.length) }, () => posts).flat() : []
	);
	const track = $derived([...filled, ...filled]);

	/**
	 * GSAP-driven horizontal carousel: a continuous auto-scroll plus
	 * grab-to-drag, both operating on the container's native scroll position
	 * (no transform/scroll conflict). Honors prefers-reduced-motion (no
	 * auto-scroll, plain native scrolling). GSAP is async-imported so it
	 * never lands in the initial bundle — same pattern as Parallax.svelte.
	 */
	function carousel(node: HTMLElement) {
		let cleanup: (() => void) | undefined;
		// Guards the async-import race: if the node unmounts before gsap
		// resolves, we skip setup entirely (otherwise listeners/tween leak
		// because `cleanup` was still undefined when destroy() ran).
		let destroyed = false;

		(async () => {
			const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			const { gsap } = await import('gsap');
			if (destroyed) return;

			// Hand-rolled step-and-dwell loop. A single GSAP timeline would snap
			// its playhead back to the previous card after a manual drag/click;
			// tracking the index ourselves lets manual interaction simply hand
			// off — the loop continues from whatever post you land on.

			// Geometry — cards are fixed-width so centres are stable; measured
			// once. targets[i] = scrollLeft that centres card i. The track is
			// doubled, so index n is card 0's duplicate: gliding onto it then
			// snapping back one copy gives an endless, seamless loop.
			const n = Math.max(1, Math.floor(node.children.length / 2));
			const centreAt = (i: number) => {
				const c = node.getBoundingClientRect();
				const k = (node.children[i] as HTMLElement).getBoundingClientRect();
				return node.scrollLeft + (k.left - c.left) - (node.clientWidth - k.width) / 2;
			};
			const targets = Array.from({ length: n + 1 }, (_, i) => centreAt(i));
			const copy = targets[n] - targets[0];
			const step = copy / n;
			const glideSec = reduce ? 0 : 0.7;
			const DWELL_MS = 2000;

			let index = 0; // currently-centred card
			let autoOn = !reduce; // whether the loop keeps advancing
			let tween: ReturnType<typeof gsap.to> | null = null;
			let dwell: ReturnType<typeof setTimeout> | undefined;

			const clearScheduled = () => {
				tween?.kill();
				tween = null;
				clearTimeout(dwell);
			};
			const scheduleNext = () => {
				if (!autoOn) return;
				clearTimeout(dwell);
				dwell = setTimeout(advance, DWELL_MS);
			};
			// Glide card i to centre, then (if auto) dwell + advance.
			function glideTo(i: number) {
				clearScheduled();
				index = ((i % n) + n) % n;
				tween = gsap.to(node, {
					scrollLeft: targets[index],
					duration: glideSec,
					ease: 'power2.inOut',
					onComplete: scheduleNext
				});
			}
			// Step forward, wrapping seamlessly through the duplicate.
			function advance() {
				if (!autoOn) return;
				if (index + 1 < n) {
					glideTo(index + 1);
					return;
				}
				clearScheduled();
				tween = gsap.to(node, {
					scrollLeft: targets[n],
					duration: glideSec,
					ease: 'power2.inOut',
					onComplete: () => {
						gsap.set(node, { scrollLeft: targets[0] }); // invisible snap-back
						index = 0;
						scheduleNext();
					}
				});
			}
			// After a drag: settle on the post nearest the current scroll,
			// folding the duplicate region back into the first copy first.
			function snapNearest() {
				let s = node.scrollLeft;
				while (s >= targets[0] + copy - step / 2) s -= copy;
				if (s !== node.scrollLeft) gsap.set(node, { scrollLeft: s });
				glideTo(Math.round((s - targets[0]) / step));
			}

			const pause = () => {
				autoOn = false;
				clearTimeout(dwell); // let any in-flight glide land; just stop advancing
			};
			const resume = () => {
				if (autoOn || reduce) return;
				autoOn = true;
				if (!tween?.isActive()) scheduleNext();
			};
			const cardIndexOf = (t: EventTarget | null) => {
				const art = (t as Element | null)?.closest('article');
				return art ? Array.prototype.indexOf.call(node.children, art) : -1;
			};

			// --- pointer: tap-to-centre + grab-to-drag. We capture only once the
			//     pointer actually MOVES, so a plain click still reaches the
			//     card's links. ---
			let downX = 0;
			let startScroll = 0;
			let downCard = -1;
			let dragging = false;
			let captured = false;

			const onDown = (e: PointerEvent) => {
				downX = e.clientX;
				startScroll = node.scrollLeft;
				downCard = cardIndexOf(e.target);
				dragging = false;
				pause();
			};
			const onMove = (e: PointerEvent) => {
				if (downCard === -1) return;
				if (!dragging && Math.abs(e.clientX - downX) > 5) {
					dragging = true;
					captured = true;
					node.setPointerCapture(e.pointerId);
					node.classList.add('dragging');
					clearScheduled();
				}
				if (dragging) node.scrollLeft = startScroll - (e.clientX - downX);
			};
			const onUp = (e: PointerEvent) => {
				if (captured) {
					node.releasePointerCapture?.(e.pointerId);
					captured = false;
					node.classList.remove('dragging');
				}
				const onLink = !!(e.target as Element | null)?.closest('a, button');
				if (dragging) {
					autoOn = !reduce;
					snapNearest(); // dragged → settle on the nearest post
				} else if (downCard !== -1 && !onLink) {
					autoOn = !reduce;
					if (reduce) gsap.set(node, { scrollLeft: targets[((downCard % n) + n) % n] });
					else glideTo(downCard); // tapped a card body → centre that post
				} else {
					resume(); // tapped a link, or pressed the padding — carry on
				}
				downCard = -1;
				dragging = false;
			};
			node.addEventListener('pointerdown', onDown);
			node.addEventListener('pointermove', onMove);
			node.addEventListener('pointerup', onUp);
			node.addEventListener('pointercancel', onUp);

			// --- hover pause/resume ---
			const onEnter = () => pause();
			const onLeave = () => {
				if (downCard === -1) resume();
			};
			node.addEventListener('pointerenter', onEnter);
			node.addEventListener('pointerleave', onLeave);

			scheduleNext(); // kick off the first dwell → advance

			cleanup = () => {
				clearScheduled();
				node.removeEventListener('pointerdown', onDown);
				node.removeEventListener('pointermove', onMove);
				node.removeEventListener('pointerup', onUp);
				node.removeEventListener('pointercancel', onUp);
				node.removeEventListener('pointerenter', onEnter);
				node.removeEventListener('pointerleave', onLeave);
			};
		})();

		return {
			destroy() {
				destroyed = true;
				cleanup?.();
			}
		};
	}
</script>

<section class="bg-olf-lightgreen pt-4 pb-8">
	<div class="flex w-full items-center justify-between px-4 pb-8 lg:px-6">
		{#if session}
			<div class="flex w-full justify-between lg:gap-4">
				<div class="flex items-center gap-2">
					<a href="/users/{session.user.id}" aria-label={m.home_profile_link()}>
						<Avatar
							animal={session.user.animal}
							avatarSeed={session.user.avatarSeed}
							gender={session.user.gender}
							size="sm"
						/>
					</a>
					<p class="font-semibold">{session.user.username}</p>
				</div>
				<div class="flex gap-2">
					<div class="flex items-center gap-1.5 rounded-full bg-olf-beige px-3 text-sm shadow-md">
						<img src={asset('egg05.webp')} alt="" class="h-4 w-4 shrink-0 object-contain" />
						<p>{session.user.coinBalance}</p>
					</div>
				</div>
			</div>
		{:else}
			<a
				href="/login"
				class="ml-auto rounded-full bg-olf-lightgreen px-3 py-1 text-sm font-bold shadow-md lg:ml-0"
			>
				{m.home_signin_link()} 🐓
			</a>
		{/if}
	</div>

	{#if posts.length > 0}
		<!-- px is half-the-viewport minus half a card (cards are w-64 = 16rem),
		     so the first/last post can sit dead-centre and the loop stays seamless. -->
		<div
			use:carousel
			class="carousel flex max-h-[50dvh] gap-3 overflow-x-auto px-[max(0px,calc(50%-8rem))] pb-2"
		>
			{#each track as post, i (post.id + '-' + i)}
				<PostCard {post} compact />
			{/each}
		</div>
	{:else}
		<p class="mt-3 text-center font-oswald text-sm text-olf-darkgreen/80">
			{m.home_latest_empty()}
		</p>
	{/if}

	<div class="mt-6 flex justify-center">
		<a
			href="/posts"
			class="flex items-center gap-2 rounded-full bg-olf-darkbrown px-5 py-2 font-oswald text-sm font-bold tracking-widest text-olf-beige uppercase"
		>
			{m.home_enter_farm()}
			<ArrowRight size={16} class="shrink-0" />
		</a>
	</div>
</section>

<style>
	.carousel {
		cursor: grab;
		scrollbar-width: none; /* Firefox — the auto-scroll is the affordance */
		touch-action: pan-y; /* let vertical page scroll through; we own horizontal */
	}
	.carousel::-webkit-scrollbar {
		display: none;
	}
	.carousel:global(.dragging) {
		cursor: grabbing;
		scroll-behavior: auto;
	}
	/* Cards must not shrink in the flex row. */
	.carousel :global(article) {
		scroll-snap-align: start;
	}
</style>
