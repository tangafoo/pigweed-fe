<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages.js';
	import Seo from '$lib/components/Seo.svelte';
	import Button from '$lib/components/Button.svelte';
	import { submitFeedback } from '$lib/api/feedback';
	import type { FeedbackTopic, Session } from '@meteorclass/pigweed-contract';
	import { Send, CheckCircle2 } from '@lucide/svelte';

	const TOPICS: { value: FeedbackTopic; label: () => string }[] = [
		{ value: 'GENERAL', label: () => m.feedback_topic_general() },
		{ value: 'EMAIL_CHANGE', label: () => m.feedback_topic_email_change() },
		{ value: 'BUG', label: () => m.feedback_topic_bug() },
		{ value: 'IDEA', label: () => m.feedback_topic_idea() }
	];
	const isTopic = (v: string | null): v is FeedbackTopic => TOPICS.some((t) => t.value === v);

	// Prefill: email from the session (if signed in), topic from ?topic= (the
	// settings card's locked-email tooltip deep-links here with EMAIL_CHANGE).
	const session = page.data.session as Session | null;
	let email = $state(session?.user.email ?? '');
	let topic = $state<FeedbackTopic>(
		isTopic(page.url.searchParams.get('topic'))
			? (page.url.searchParams.get('topic') as FeedbackTopic)
			: 'GENERAL'
	);
	let message = $state('');

	let sent = $state(false);
	let sending = $state(false);
	let errored = $state(false);

	async function submit() {
		if (sending) return;
		errored = false;
		sending = true;
		const ok = await submitFeedback({ email: email.trim(), topic, message: message.trim() });
		sending = false;
		if (ok) sent = true;
		else errored = true;
	}

	const valid = $derived(
		/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && message.trim().length > 0
	);
</script>

<Seo title={m.feedback_page_title()} description="Get in touch with Our Little Farm." noindex />

<div class="flex-1 bg-olf-lightgreen px-4 py-10">
	<div class="mx-auto max-w-lg">
		<h1 class="mb-1 font-homemade-apple text-4xl font-bold text-olf-darkbrown">
			{m.feedback_heading()}
		</h1>
		<p class="mb-6 font-oswald text-sm text-olf-darkbrown/70">{m.feedback_intro()}</p>

		{#if sent}
			<div
				class="flex items-center gap-3 rounded-2xl bg-olf-eggshell p-6 font-oswald text-olf-darkgreen shadow-md"
			>
				<CheckCircle2 size={28} class="shrink-0 text-olf-moss" />
				<p class="font-bold">{m.feedback_success()}</p>
			</div>
		{:else}
			<form
				onsubmit={(e) => {
					e.preventDefault();
					submit();
				}}
				class="flex flex-col gap-4 rounded-2xl bg-olf-eggshell p-6 shadow-md"
			>
				<label class="flex flex-col gap-1">
					<span class="font-oswald text-xs font-bold tracking-wide text-olf-darkbrown/60 uppercase">
						{m.feedback_topic_label()}
					</span>
					<select
						bind:value={topic}
						class="cursor-pointer rounded-lg border border-olf-darkbrown/20 bg-white px-3 py-2 font-oswald text-olf-darkbrown"
					>
						{#each TOPICS as t (t.value)}
							<option value={t.value}>{t.label()}</option>
						{/each}
					</select>
				</label>

				<label class="flex flex-col gap-1">
					<span class="font-oswald text-xs font-bold tracking-wide text-olf-darkbrown/60 uppercase">
						{m.feedback_email_label()}
					</span>
					<input
						bind:value={email}
						type="email"
						required
						class="rounded-lg border border-olf-darkbrown/20 bg-white px-3 py-2 font-oswald text-olf-darkbrown"
					/>
				</label>

				<label class="flex flex-col gap-1">
					<span class="font-oswald text-xs font-bold tracking-wide text-olf-darkbrown/60 uppercase">
						{m.feedback_message_label()}
					</span>
					<textarea
						bind:value={message}
						rows="5"
						maxlength="4000"
						placeholder={m.feedback_message_placeholder()}
						class="resize-y rounded-lg border border-olf-darkbrown/20 bg-white px-3 py-2 font-oswald text-olf-darkbrown"
					></textarea>
				</label>

				{#if errored}
					<p class="font-oswald text-sm text-red-700">{m.feedback_error()}</p>
				{/if}

				<Button
					type="submit"
					disabled={!valid}
					loading={sending}
					class="inline-flex items-center justify-center gap-1.5 rounded-full bg-olf-darkgreen px-5 py-2.5 font-oswald font-bold text-olf-eggshell disabled:opacity-50"
				>
					{#if !sending}<Send size={15} class="shrink-0" />{/if}
					{sending ? m.feedback_sending() : m.feedback_submit()}
				</Button>
			</form>
		{/if}
	</div>
</div>
