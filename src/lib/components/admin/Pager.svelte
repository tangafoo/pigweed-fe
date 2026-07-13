<script lang="ts">
	// Shared Prev / Page x of y / Next / Last controls for the admin tables
	// (Eggs ledger, Users, Log). `page` is bindable; the parent derives `pages`
	// from whatever row set it pages.
	let { page = $bindable(1), pages }: { page?: number; pages: number } = $props();
</script>

<div class="flex items-center justify-center gap-4 font-oswald text-sm text-olf-darkgreen">
	<button
		type="button"
		disabled={page <= 1}
		onclick={() => (page -= 1)}
		class="underline disabled:opacity-40">← Prev</button
	>
	<span class="tabular-nums">Page {page} of {pages}</span>
	<button
		type="button"
		disabled={page >= pages}
		onclick={() => (page += 1)}
		class="underline disabled:opacity-40">Next →</button
	>
	<button
		type="button"
		disabled={page >= pages}
		onclick={() => (page = pages)}
		class="underline disabled:opacity-40">Last »</button
	>
</div>
