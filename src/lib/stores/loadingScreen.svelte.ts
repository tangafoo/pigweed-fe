/**
 * Global, iOS-style blocking loading screen — for the BIG async flows
 * (signing in/up, publishing a post) where the whole app should visibly
 * pause. Small inline actions keep using ui/Spinner.svelte.
 *
 * Rendered once by ui/LoadingOverlay.svelte in the root layout; callers
 * just `loadingScreen.during(work, message)` (or show/hide manually).
 * Each show picks a random chicken drawing from the brand art pool.
 */

/** Existing brand art in the R2 assets bucket — do not invent new keys. */
const CHICKEN_ART = [
	'henkerchief.webp',
	'hen with chicks.webp',
	'chicken-drawing-white.webp',
	'chicken-drawing-brown.webp'
] as const;

class LoadingScreen {
	visible = $state(false);
	message = $state<string | null>(null);
	artKey = $state<string>(CHICKEN_ART[0]);

	show(message?: string) {
		// Re-randomize only when newly shown, so an in-flight message update
		// never swaps the chicken mid-animation.
		if (!this.visible) {
			this.artKey = CHICKEN_ART[Math.floor(Math.random() * CHICKEN_ART.length)];
		}
		this.message = message ?? null;
		this.visible = true;
	}

	/** Update the caption while staying visible (e.g. uploading → posting). */
	update(message: string) {
		this.message = message;
	}

	hide() {
		this.visible = false;
		this.message = null;
	}

	/** Show for the lifetime of `work`; always hides, even on throw. */
	async during<T>(work: Promise<T>, message?: string): Promise<T> {
		this.show(message);
		try {
			return await work;
		} finally {
			this.hide();
		}
	}
}

export const loadingScreen = new LoadingScreen();
