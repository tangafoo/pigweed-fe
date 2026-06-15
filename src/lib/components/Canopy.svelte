<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';

	// Crown-shyness skyline: a row of tree crowns viewed from below, each a
	// wobbly foliage hull with branch-veins radiating from a trunk that
	// enters from the top edge. Crowns are spaced so the background shows
	// through the gaps between them — that's the "shyness". Everything is
	// procedural (seeded), so it's deterministic across SSR/hydration and a
	// new SEED rerolls the forest. The gusty wind is baked in (calm → gust →
	// settle), driven by one shared strength so a gust sweeps the whole row.
	interface CanopyProps extends SVGAttributes<SVGSVGElement> {
		seed?: number;
		count?: number;
	}
	let { seed = 0xca0, count = 5, ...rest }: CanopyProps = $props();

	const W = 1200;
	const H = 340;
	const GREENS = ['#5a8a3a', '#6f9c3f', '#7faa47', '#8cb653', '#4f7d33', '#659140'];
	const TRUNK = '#5a4326';

	function rng(s: number) {
		let a = s >>> 0;
		return () => {
			a = (a + 0x6d2b79f5) | 0;
			let t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
	const f = (n: number) => n.toFixed(1);

	type Crown = { fill: string; hull: string; trunk: string; veins: string[]; ox: number; oy: number };

	// Smooth closed path through points (quadratics via midpoints).
	function smoothClosed(pts: [number, number][]): string {
		const n = pts.length;
		const mid = (a: [number, number], b: [number, number]): [number, number] => [
			(a[0] + b[0]) / 2,
			(a[1] + b[1]) / 2
		];
		const m0 = mid(pts[n - 1], pts[0]);
		let d = `M${f(m0[0])} ${f(m0[1])}`;
		for (let i = 0; i < n; i++) {
			const cur = pts[i];
			const m = mid(cur, pts[(i + 1) % n]);
			d += ` Q${f(cur[0])} ${f(cur[1])} ${f(m[0])} ${f(m[1])}`;
		}
		return d + 'Z';
	}

	// Re-derived if seed/count change. The whole forest grows from one seed.
	const crowns = $derived.by(() => {
		const r = rng(seed);
		const make = (i: number): Crown => {
			const cellW = W / count;
			const cx = (i + 0.5) * cellW + (r() - 0.5) * cellW * 0.16;
			const cy = H * 0.46 + (r() - 0.5) * 46;
			const R = cellW * 0.46 * lerp(0.9, 1.12, r());

			// wobbly hull (slightly flattened) → organic crown outline
			const N = 16;
			const pts: [number, number][] = [];
			for (let k = 0; k < N; k++) {
				const ang = (k / N) * Math.PI * 2 - Math.PI / 2;
				const rad = R * lerp(0.82, 1.16, r());
				pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.92]);
			}
			const hull = smoothClosed(pts);

			// trunk drops in from the top edge to a hub low in the crown
			const tx = cx + (r() - 0.5) * R * 0.4;
			const hubx = cx;
			const huby = cy + R * 0.16;
			const trunk = `M${f(tx)} -12 Q${f(tx + (hubx - tx) * 0.5)} ${f(huby * 0.5)} ${f(hubx)} ${f(huby)}`;

			// branch-veins radiate from the hub to every hull point, each with
			// a pair of forks near its outer third — the feathery crown texture
			const veins: string[] = [];
			for (const p of pts) {
				const mx = (hubx + p[0]) / 2;
				const my = (huby + p[1]) / 2;
				const bow = (r() - 0.5) * R * 0.14;
				veins.push(`M${f(hubx)} ${f(huby)} Q${f(mx + bow)} ${f(my - Math.abs(bow))} ${f(p[0])} ${f(p[1])}`);
				const fx = lerp(hubx, p[0], 0.6);
				const fy = lerp(huby, p[1], 0.6);
				const ang = Math.atan2(p[1] - huby, p[0] - hubx);
				const fl = R * 0.2;
				veins.push(`M${f(fx)} ${f(fy)} L${f(fx + Math.cos(ang - 0.5) * fl)} ${f(fy + Math.sin(ang - 0.5) * fl)}`);
				veins.push(`M${f(fx)} ${f(fy)} L${f(fx + Math.cos(ang + 0.5) * fl)} ${f(fy + Math.sin(ang + 0.5) * fl)}`);
			}

			return { fill: GREENS[Math.floor(r() * GREENS.length)], hull, trunk, veins, ox: tx, oy: 0 };
		};
		return Array.from({ length: count }, (_, i) => make(i));
	});

	/**
	 * Gusty wind: most of the time the canopy idles with a slow drift; every
	 * few seconds a gust sweeps through (~2s) then settles. One shared
	 * `strength` proxy is animated through the calm→gust→settle cycle and a
	 * ticker maps it (plus a per-crown idle sine) onto each crown's rotation,
	 * pivoting at the trunk entry. Async GSAP, reduced-motion aware.
	 */
	function wind(node: SVGSVGElement) {
		let stop: (() => void) | undefined;

		(async () => {
			if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
			const { gsap } = await import('gsap');
			const els = Array.from(node.querySelectorAll<SVGGElement>('[data-crown]'));
			els.forEach((el) => gsap.set(el, { svgOrigin: `${el.dataset.ox} ${el.dataset.oy}` }));

			const strength = { v: 0 };
			const gust = gsap
				.timeline({ repeat: -1 })
				.to(strength, { v: 1, duration: 0.8, ease: 'power2.in', delay: 5 }) // gust hits
				.to(strength, { v: 0.55, duration: 0.5, ease: 'sine.inOut' }) // buffet
				.to(strength, { v: 0.95, duration: 0.45, ease: 'sine.inOut' })
				.to(strength, { v: 0, duration: 1.5, ease: 'power3.out' }); // settle

			const start = performance.now();
			const tick = () => {
				const t = (performance.now() - start) / 1000;
				els.forEach((el, i) => {
					const ph = i * 0.8;
					const idle = Math.sin(t * 0.5 + ph) * 1.1; // gentle constant drift
					const gustSway = strength.v * (5 + (i % 3) * 1.6) * Math.sin(t * 2.6 + ph);
					gsap.set(el, { rotation: idle + gustSway });
				});
			};
			gsap.ticker.add(tick);
			stop = () => {
				gust.kill();
				gsap.ticker.remove(tick);
			};
		})();

		return { destroy: () => stop?.() };
	}
</script>

<svg
	viewBox="0 0 {W} {H}"
	preserveAspectRatio="xMidYMin slice"
	xmlns="http://www.w3.org/2000/svg"
	use:wind
	{...rest}
>
	{#each crowns as c, i (i)}
		<g data-crown data-ox={c.ox} data-oy={c.oy}>
			<path d={c.trunk} fill="none" stroke={TRUNK} stroke-width="9" stroke-linecap="round" />
			<path d={c.hull} fill={c.fill} />
			<g fill="none" stroke="rgba(20,45,15,0.4)" stroke-width="1.4" stroke-linecap="round">
				{#each c.veins as d, k (k)}
					<path {d} />
				{/each}
			</g>
		</g>
	{/each}
</svg>
