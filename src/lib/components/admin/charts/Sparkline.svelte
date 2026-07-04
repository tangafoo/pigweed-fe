<script lang="ts">
	// A tiny axis-less area+line — a customer's order history at a glance.
	// Single hue (brand green); baseline sits at the series min so shape, not
	// absolute magnitude, is what reads. Purely decorative-of-data: no ticks.
	let {
		values,
		width = 160,
		height = 40,
		color = 'var(--color-olf-moss)'
	}: {
		values: number[];
		width?: number;
		height?: number;
		color?: string;
	} = $props();

	const PAD = 3;
	const geom = $derived.by(() => {
		const n = values.length;
		if (n === 0) return null;
		const max = Math.max(...values);
		const min = Math.min(...values);
		const span = max - min || 1;
		const w = width - PAD * 2;
		const h = height - PAD * 2;
		const x = (i: number) => PAD + (n === 1 ? w / 2 : (i / (n - 1)) * w);
		const y = (v: number) => PAD + h - ((v - min) / span) * h;
		const pts = values.map((v, i) => `${x(i)},${y(v)}`);
		const line = `M ${pts.join(' L ')}`;
		const area = `${line} L ${x(n - 1)},${PAD + h} L ${x(0)},${PAD + h} Z`;
		return { line, area, lastX: x(n - 1), lastY: y(values[n - 1]) };
	});
</script>

{#if geom}
	<svg {width} {height} viewBox="0 0 {width} {height}" class="overflow-visible">
		<path d={geom.area} fill={color} opacity="0.15" />
		<path
			d={geom.line}
			fill="none"
			stroke={color}
			stroke-width="2"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
		<circle
			cx={geom.lastX}
			cy={geom.lastY}
			r="3"
			fill={color}
			stroke="var(--color-olf-beige)"
			stroke-width="2"
		/>
	</svg>
{/if}
