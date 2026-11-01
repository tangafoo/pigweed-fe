// Animated .ani cursor for a single page (Farmdex starfish, Projects Mike).
// Browsers can't play .ani natively, so ani-cursor turns its frames into a
// CSS @keyframes that steps `cursor: url(...)` (still the native cursor, so
// no lag). It runs once on <html> and everything inherits it; running it
// per-element would restart the loop on every hover change (flicker).
// The inherit rule sits in the `components` layer: above layout.css's
// `@layer base` hand pointer on buttons, below utilities like the lens's
// `cursor-none`. Call from onMount; the returned cleanup removes it on leave.
// ani-cursor is imported lazily (browser only): its `riff-file` dep is
// CommonJS and breaks Node's SSR import, which 500s the page.

// Rewrites every frame's hotspot (click point) to its centre, for cursors
// whose own hotspot sits off the drawing (the starfish's is an arm tip).
// Walks the RIFF chunks; each `icon` is a .cur file whose ICONDIRENTRY holds
// width/height at +6/+7 and the hotspot x/y (u16 LE) at +10/+12.
function centerHotspots(bytes: Uint8Array): Uint8Array {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const id = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
	const walk = (start: number, end: number) => {
		for (let at = start; at + 8 <= end; ) {
			const size = view.getUint32(at + 4, true);
			const data = at + 8;
			if (id(at) === 'LIST') walk(data + 4, data + size);
			else if (id(at) === 'icon' && size >= 14) {
				const w = bytes[data + 6] || 256;
				const h = bytes[data + 7] || 256;
				view.setUint16(data + 10, w >> 1, true);
				view.setUint16(data + 12, h >> 1, true);
			}
			at = data + size + (size & 1);
		}
	};
	walk(12, bytes.length);
	return bytes;
}

export function mountAniCursor(url: string, { centerHotspot = false } = {}): () => void {
	let style: HTMLStyleElement | undefined;
	let left = false; // navigated away before the fetch finished
	Promise.all([import('ani-cursor'), fetch(url).then((r) => r.arrayBuffer())])
		.then(([{ convertAniBinaryToCSS }, buf]) => {
			if (left) return;
			style = document.createElement('style');
			const raw = new Uint8Array(buf);
			const bytes = centerHotspot ? centerHotspots(raw) : raw;
			// Also on <dialog>: a modal dialog makes the page (incl. <html>)
			// inert, and inert elements stop matching :hover, so the html
			// animation pauses while the overlay is open.
			style.textContent =
				convertAniBinaryToCSS('html', bytes) +
				convertAniBinaryToCSS('dialog', bytes) +
				'@layer components { html * { cursor: inherit; } }';
			document.head.appendChild(style);
		})
		.catch(() => {}); // cosmetic — fall back to the normal cursor
	return () => {
		left = true;
		style?.remove();
	};
}
