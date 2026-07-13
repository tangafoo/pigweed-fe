<script module lang="ts">
	// Per-instance counter → unique clipPath ids. Increments in render order,
	// so SSR and client agree (no hydration id mismatch).
	let uid = 0;
</script>

<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';

	// Flat, painterly leaves traced from a layered-jungle reference — no
	// hard outlines, just a solid fill with quieter veins clipped to the
	// leaf body. Four cuts share the family; depth comes from stacking many
	// at different greens. Every leaf "points up" (tip at top, stem at the
	// bottom of its viewBox), so callers aim it by rotating. Colour is all
	// CSS vars so each instance can be its own shade.
	interface LeafProps extends SVGAttributes<SVGSVGElement> {
		variant?: 'broad' | 'lance' | 'oval' | 'fern';
	}
	let { variant = 'broad', ...rest }: LeafProps = $props();

	// eslint-disable-next-line no-useless-assignment -- module-level counter; the NEXT instance reads the incremented value
	const clip = `leaf-clip-${uid++}`;

	const VIEWBOX = {
		broad: '0 0 100 140',
		lance: '0 0 64 150',
		oval: '0 0 92 120',
		fern: '0 0 96 150'
	} as const;

	// Body silhouettes — reused for both the fill and the vein clip.
	const BODY = {
		broad: 'M50 6 C 80 30 86 92 52 134 C 51 135 49 135 48 134 C 14 92 20 30 50 6 Z',
		lance: 'M32 4 C 46 30 46 110 33 146 C 32.5 147 31.5 147 31 146 C 18 110 18 30 32 4 Z',
		oval: 'M46 6 C 76 26 80 92 47 114 C 46.5 114.6 45.5 114.6 45 114 C 12 92 16 26 46 6 Z'
	} as const;

	// --- fern is generated: a rachis with leaflets that shrink toward the
	// tip, mirrored left/right, plus a terminal leaflet. ---
	function leaflet(bx: number, by: number, tx: number, ty: number, w: number) {
		const mx = (bx + tx) / 2;
		const my = (by + ty) / 2;
		const dx = tx - bx;
		const dy = ty - by;
		const len = Math.hypot(dx, dy) || 1;
		const px = (-dy / len) * w;
		const py = (dx / len) * w;
		const f = (n: number) => n.toFixed(1);
		return `M${f(bx)} ${f(by)} Q${f(mx + px)} ${f(my + py)} ${f(tx)} ${f(ty)} Q${f(mx - px)} ${f(my - py)} ${f(bx)} ${f(by)} Z`;
	}
	const fernLeaflets = Array.from({ length: 9 }, (_, i) => {
		const t = i / 8;
		const y = 140 - t * 122; // base (140) → near tip (18)
		const len = 34 * (1 - 0.62 * t); // shrink toward the tip
		const ty = y - len * 0.6;
		const w = len * 0.26;
		return [leaflet(48, y, 48 + len, ty, w), leaflet(48, y, 48 - len, ty, w)];
	}).flat();
	const fernTip = leaflet(48, 22, 48, 2, 4);
</script>

<svg
	viewBox={VIEWBOX[variant]}
	xmlns="http://www.w3.org/2000/svg"
	style="
		--fill: var(--leaf-fill, #4e7a3a);
		--vein: var(--leaf-vein, rgba(20,40,15,0.32));
	"
	{...rest}
>
	{#if variant === 'broad'}
		<defs><clipPath id={clip}><path d={BODY.broad} /></clipPath></defs>
		<path d={BODY.broad} fill="var(--fill)" />
		<g
			clip-path="url(#{clip})"
			fill="none"
			stroke="var(--vein)"
			stroke-width="2.4"
			stroke-linecap="round"
		>
			<path d="M50 14 L50 130" />
			<path d="M50 36 C 40 34 32 36 24 44" />
			<path d="M50 56 C 39 54 30 56 22 66" />
			<path d="M50 78 C 40 76 33 80 27 90" />
			<path d="M50 98 C 41 97 35 101 30 110" />
			<path d="M50 36 C 60 34 68 36 76 44" />
			<path d="M50 56 C 61 54 70 56 78 66" />
			<path d="M50 78 C 60 76 67 80 73 90" />
			<path d="M50 98 C 59 97 65 101 70 110" />
		</g>
	{:else if variant === 'lance'}
		<defs><clipPath id={clip}><path d={BODY.lance} /></clipPath></defs>
		<path d={BODY.lance} fill="var(--fill)" />
		<g
			clip-path="url(#{clip})"
			fill="none"
			stroke="var(--vein)"
			stroke-width="2.2"
			stroke-linecap="round"
		>
			<path d="M32 10 L32 144" />
			<path d="M32 26 L22 20" />
			<path d="M32 44 L21 38" />
			<path d="M32 62 L20 56" />
			<path d="M32 80 L20 74" />
			<path d="M32 98 L21 92" />
			<path d="M32 116 L23 110" />
			<path d="M32 26 L42 20" />
			<path d="M32 44 L43 38" />
			<path d="M32 62 L44 56" />
			<path d="M32 80 L44 74" />
			<path d="M32 98 L43 92" />
			<path d="M32 116 L41 110" />
		</g>
	{:else if variant === 'oval'}
		<defs><clipPath id={clip}><path d={BODY.oval} /></clipPath></defs>
		<path d={BODY.oval} fill="var(--fill)" />
		<g
			clip-path="url(#{clip})"
			fill="none"
			stroke="var(--vein)"
			stroke-width="2.3"
			stroke-linecap="round"
		>
			<path d="M46 12 L46 112" />
			<path d="M46 40 C 38 38 32 42 27 50" />
			<path d="M46 62 C 38 60 33 64 28 73" />
			<path d="M46 84 C 39 83 34 87 30 95" />
			<path d="M46 40 C 54 38 60 42 65 50" />
			<path d="M46 62 C 54 60 59 64 64 73" />
			<path d="M46 84 C 53 83 58 87 62 95" />
		</g>
	{:else}
		<!-- fern / compound frond -->
		<path
			d="M48 146 L48 18"
			fill="none"
			stroke="var(--vein)"
			stroke-width="2.6"
			stroke-linecap="round"
		/>
		<g fill="var(--fill)">
			{#each fernLeaflets as d, i (i)}
				<path {d} />
			{/each}
			<path d={fernTip} />
		</g>
	{/if}
</svg>
