<script lang="ts">
	import type { Component } from 'svelte';
	import { Ban } from '@lucide/svelte';

	interface NoIconProps {
		icon: Component<{ size?: number | string; strokeWidth?: number | string; class?: string }>;
		size?: number;
		class?: string;
	}

	let { icon: Icon, size = 18, class: className = '' }: NoIconProps = $props();
</script>

<span class="relative inline-flex items-center justify-center {className}">
	<Icon {size} class="shrink-0 p-2.5" />
	<Ban size={size + 4} strokeWidth={1.2} class="absolute opacity-85" />
</span>
