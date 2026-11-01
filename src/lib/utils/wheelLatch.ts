// Wheel events closer together than this belong to one gesture (trackpad
// momentum keeps firing well under it).
const GESTURE_GAP_MS = 250;

/**
 * Edge latch for an inner scroller: a wheel gesture that was scrolling it
 * stays with it after it hits the edge (momentum included), so a big flick
 * doesn't carry on into whatever is behind. Only a NEW gesture, started at
 * the edge, falls through.
 *
 * Call the returned fn on every wheel event with whether that event moves the
 * scroller; it returns true when the event should be swallowed
 * (`preventDefault`).
 */
export function createWheelLatch() {
	let last = 0;
	let latched = false;
	return (moves: boolean): boolean => {
		const now = performance.now();
		if (now - last > GESTURE_GAP_MS) latched = false;
		last = now;
		if (moves) latched = true;
		return !moves && latched;
	};
}

/** Whether a wheel event can still scroll `el` vertically in its direction. */
export function canScrollY(el: HTMLElement, e: WheelEvent): boolean {
	if (e.deltaY < 0) return el.scrollTop > 0;
	if (e.deltaY > 0) return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
	return false;
}
