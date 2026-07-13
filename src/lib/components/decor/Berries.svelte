<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';

	// The little coral berry clusters from the reference — a few stems
	// converging to a bunch of berries. Colour via CSS vars so they can be
	// recoloured per instance.
	type BerriesProps = SVGAttributes<SVGSVGElement>;
	let { ...rest }: BerriesProps = $props();
</script>

<svg
	viewBox="0 0 40 52"
	xmlns="http://www.w3.org/2000/svg"
	style="--berry: var(--berry-fill, #e0594d); --berry-dark: var(--berry-stem, #3f5e2e);"
	{...rest}
>
	<g fill="none" stroke="var(--berry-dark)" stroke-width="1.4" stroke-linecap="round">
		<path d="M20 52 L20 24" />
		<path d="M20 30 L11 19" />
		<path d="M20 30 L29 18" />
		<path d="M20 26 L20 11" />
		<path d="M20 28 L14 15" />
		<path d="M20 28 L27 13" />
	</g>
	<g fill="var(--berry)">
		<circle cx="11" cy="17" r="5" />
		<circle cx="29" cy="16" r="5" />
		<circle cx="20" cy="9" r="5" />
		<circle cx="14" cy="13" r="4.3" />
		<circle cx="27" cy="11" r="4.3" />
	</g>
	<g fill="rgba(90,25,20,0.55)">
		<circle cx="11" cy="17" r="1" />
		<circle cx="29" cy="16" r="1" />
		<circle cx="20" cy="9" r="1" />
		<circle cx="14" cy="13" r="0.9" />
		<circle cx="27" cy="11" r="0.9" />
	</g>
</svg>
