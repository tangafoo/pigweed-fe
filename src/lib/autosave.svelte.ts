// Reusable debounced auto-save with a visible countdown.
//
// Call `touch()` on every change you want to debounce — it (re)starts a
// countdown from `seconds`. When it hits zero the `save` fn runs. `cancel()`
// aborts; `flush()` saves immediately. Expose `active` + `secondsLeft` to drive
// a "Saving in 5… [Cancel]" UI. Designed to be shared across the app (benefits
// catalog now, tier checklists / settings later).
//
// Usage (in a .svelte component):
//   const autosave = createAutosave(() => run(saveAll));
//   ... oninput={() => autosave.touch()} ...
//   {#if autosave.active}Saving in {autosave.secondsLeft}…{/if}
//   onDestroy(() => autosave.cancel());
export function createAutosave(save: () => Promise<unknown> | unknown, seconds = 5) {
	let secondsLeft = $state(0);
	let active = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;

	function stop() {
		if (timer) clearInterval(timer);
		timer = undefined;
		active = false;
		secondsLeft = 0;
	}

	function touch() {
		if (timer) clearInterval(timer);
		active = true;
		secondsLeft = seconds;
		timer = setInterval(() => {
			secondsLeft -= 1;
			if (secondsLeft <= 0) void flush();
		}, 1000);
	}

	async function flush() {
		stop();
		await save();
	}

	function cancel() {
		stop();
	}

	return {
		get secondsLeft() {
			return secondsLeft;
		},
		get active() {
			return active;
		},
		touch,
		flush,
		cancel
	};
}
