<script lang="ts">
	// Renders a (possibly localized) string and animates only its digit
	// characters with a vertical odometer/split-flap roll when the value changes.
	// Non-digits (spaces, "eggs", "개", etc.) render statically, so the visible
	// text is unchanged from `{text}` — we only add motion. Keyed by character
	// position so each digit column persists and its transform transitions.
	interface RollingNumberProps {
		text: string;
	}
	let { text }: RollingNumberProps = $props();

	const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
	const chars = $derived([...text]);
	const isDigit = (c: string) => c >= '0' && c <= '9';
</script>

<span class="roll" aria-hidden="true"
	>{#each chars as ch, i (i)}{#if isDigit(ch)}<span class="digit"
				><span class="strip" style="transform: translateY(-{Number(ch)}em)"
					>{#each DIGITS as d (d)}<span class="line">{d}</span>{/each}</span
				></span
			>{:else}{ch}{/if}{/each}</span
><span class="sr-only">{text}</span>

<style>
	.roll {
		white-space: pre; /* keep spaces inside the label */
	}
	.digit {
		display: inline-block;
		height: 1em;
		overflow: hidden;
		line-height: 1;
		/* overflow:hidden moves the inline-block baseline to its bottom edge;
		   nudge it back up onto the text baseline. */
		vertical-align: -0.15em;
	}
	.strip {
		display: flex;
		flex-direction: column;
		transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
		will-change: transform;
	}
	.line {
		height: 1em;
		line-height: 1;
		text-align: center;
	}
	@media (prefers-reduced-motion: reduce) {
		.strip {
			transition: none;
		}
	}
</style>
