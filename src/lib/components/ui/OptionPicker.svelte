<script lang="ts" generics="T extends string | number">
	import FilterDropdown from './FilterDropdown.svelte';

	// The bare "pick one of these" dropdown — a styled stand-in for a native
	// <select>. FilterDropdown owns the trigger/popover mechanics; this layer
	// owns the standard option list. Anything fancier (icons per option, rich
	// triggers) should use FilterDropdown directly.
	interface PickerOption {
		value: T;
		label: string;
	}
	interface OptionPickerProps {
		options: readonly PickerOption[];
		value: T;
		/** Fires after `value` updates (e.g. to refetch). */
		onchange?: (value: T) => void;
		/** Trigger pill colour override (defaults to FilterDropdown's beige). */
		triggerClass?: string;
	}
	let { options, value = $bindable(), onchange, triggerClass }: OptionPickerProps = $props();

	const currentLabel = $derived(options.find((o) => o.value === value)?.label ?? String(value));
</script>

<FilterDropdown label={currentLabel} {triggerClass}>
	{#snippet children(close)}
		{#each options as o (o.value)}
			<li>
				<button
					type="button"
					role="option"
					aria-selected={value === o.value}
					onclick={() => {
						value = o.value;
						onchange?.(o.value);
						close();
					}}
					class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left font-oswald text-sm text-olf-darkbrown transition-colors hover:bg-olf-darkgreen/10 {value ===
					o.value
						? 'font-bold'
						: ''}"
				>
					{o.label}
				</button>
			</li>
		{/each}
	{/snippet}
</FilterDropdown>
