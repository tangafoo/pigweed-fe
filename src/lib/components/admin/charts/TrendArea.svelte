<script lang="ts">
	import { compactNumber } from '$lib/utils/analytics';

	// Single-series area+line trend over time (sequential, one brand hue — no
	// legend needed, the section title names the metric). Responsive: geometry
	// is computed in px against the measured width. Ships a crosshair + tooltip
	// by default (an HTML/SVG chart IS interactive). Recessive hairline grid.
	let {
		points,
		format,
		axisFormat = compactNumber,
		height = 200
	}: {
		points: { label: string; value: number }[];
		format: (n: number) => string;
		axisFormat?: (n: number) => string;
		height?: number;
	} = $props();

	let width = $state(600);
	let wrap = $state<HTMLDivElement>();

	const PAD = { l: 52, r: 14, t: 12, b: 22 };

	// Round a max up to a clean axis bound (1/2/2.5/5/10 × 10ⁿ).
	function niceMax(v: number): number {
		if (v <= 0) return 1;
		const base = Math.pow(10, Math.floor(Math.log10(v)));
		const f = v / base;
		const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
		return nf * base;
	}

	const TICKS = 4;
	const geom = $derived.by(() => {
		const n = points.length;
		const plotW = Math.max(1, width - PAD.l - PAD.r);
		const plotH = Math.max(1, height - PAD.t - PAD.b);
		const yMax = niceMax(Math.max(0, ...points.map((p) => p.value)));
		const x = (i: number) => PAD.l + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
		const y = (v: number) => PAD.t + plotH - (v / yMax) * plotH;

		const coords = points.map((p, i) => ({ x: x(i), y: y(p.value), ...p }));
		const line = coords.length ? `M ${coords.map((c) => `${c.x},${c.y}`).join(' L ')}` : '';
		const baseY = PAD.t + plotH;
		const area = coords.length
			? `${line} L ${coords[coords.length - 1].x},${baseY} L ${coords[0].x},${baseY} Z`
			: '';

		const yTicks = Array.from({ length: TICKS + 1 }, (_, i) => {
			const v = (yMax / TICKS) * i;
			return { v, y: y(v) };
		});

		// ~5 evenly-spaced x labels so they never collide.
		const xStep = Math.max(1, Math.ceil(n / 5));
		const xTicks = coords.filter((_, i) => i % xStep === 0 || i === n - 1);

		return { coords, line, area, yTicks, xTicks, plotW, baseY };
	});

	let hoverIdx = $state<number | null>(null);
	function onMove(e: PointerEvent) {
		const n = points.length;
		if (n === 0 || !wrap) return;
		// Measure against the wrapper (SVG fills it 1:1), not SVG offsetX which is
		// browser-inconsistent for nested SVG targets.
		const mx = e.clientX - wrap.getBoundingClientRect().left;
		const plotW = Math.max(1, width - PAD.l - PAD.r);
		const rel = (mx - PAD.l) / plotW;
		hoverIdx = Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1))));
	}
	const hover = $derived(hoverIdx != null ? geom.coords[hoverIdx] : null);
	// Keep the tooltip inside the chart box.
	const tipLeft = $derived(hover ? Math.min(Math.max(hover.x, 46), width - 46) : 0);
</script>

<div class="relative w-full" bind:this={wrap} bind:clientWidth={width}>
	<svg {width} {height} viewBox="0 0 {width} {height}" role="img" aria-label="Trend over time">
		<!-- horizontal gridlines + y ticks -->
		{#each geom.yTicks as t (t.v)}
			<line
				x1={PAD.l}
				y1={t.y}
				x2={width - PAD.r}
				y2={t.y}
				stroke="var(--color-olf-darkgreen)"
				stroke-opacity="0.1"
				stroke-width="1"
			/>
			<text
				x={PAD.l - 8}
				y={t.y}
				text-anchor="end"
				dominant-baseline="middle"
				class="fill-olf-darkgreen/50 font-oswald text-[10px] tabular-nums"
			>
				{axisFormat(t.v)}
			</text>
		{/each}

		<!-- x labels -->
		{#each geom.xTicks as t (t.label)}
			<text
				x={t.x}
				y={height - 6}
				text-anchor="middle"
				class="fill-olf-darkgreen/50 font-oswald text-[10px]"
			>
				{t.label}
			</text>
		{/each}

		<!-- the series -->
		<path d={geom.area} fill="var(--color-olf-moss)" opacity="0.16" />
		<path
			d={geom.line}
			fill="none"
			stroke="var(--color-olf-darkgreen)"
			stroke-width="2"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>

		<!-- hover crosshair + point -->
		{#if hover}
			<line
				x1={hover.x}
				y1={PAD.t}
				x2={hover.x}
				y2={geom.baseY}
				stroke="var(--color-olf-darkgreen)"
				stroke-opacity="0.35"
				stroke-width="1"
			/>
			<circle
				cx={hover.x}
				cy={hover.y}
				r="4.5"
				fill="var(--color-olf-darkgreen)"
				stroke="var(--color-olf-beige)"
				stroke-width="2"
			/>
		{/if}

		<!-- transparent hit layer (decorative — the series data is exposed via the
		     svg's role/aria-label and the tooltip) -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<rect
			x={PAD.l}
			y={PAD.t}
			width={geom.plotW}
			height={height - PAD.t - PAD.b}
			fill="transparent"
			aria-hidden="true"
			onpointermove={onMove}
			onpointerleave={() => (hoverIdx = null)}
		/>
	</svg>

	{#if hover}
		<div
			class="pointer-events-none absolute -translate-x-1/2 rounded-lg bg-olf-darkgreen px-2.5 py-1.5 text-center font-oswald whitespace-nowrap text-olf-eggshell shadow-lg"
			style="left: {tipLeft}px; top: 0px;"
		>
			<div class="text-sm font-bold tabular-nums">{format(hover.value)}</div>
			<div class="text-xxs text-olf-eggshell/70">{hover.label}</div>
		</div>
	{/if}
</div>
