// Animated .ani cursor for a single page (Farmdex starfish, Volunteer horse; static ones via
// mountCursor below, e.g. the Projects butterflies).
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

/**
 * Cursor from plain images (.cur, single-size .ico, or PNG frames) for a
 * single page, same inheritance as above. Browsers show these natively.
 * Keep them small: Chrome ignores cursors over 128px, and from a multi-size
 * .ico it may pick the 256px image. A url = a still cursor; a list of
 * `[url, ms]` frames = an animation looping through them.
 * `hotspot` is the click point (a .cur's own one wins for a still cursor).
 */
export function mountCursor(
	image: string | [url: string, ms: number][],
	{ hotspot = [16, 16] }: { hotspot?: [number, number] } = {}
): () => void {
	const frames = typeof image === 'string' ? [[image, 0] as const] : image;
	const cursor = (url: string) => `cursor: url('${url}') ${hotspot[0]} ${hotspot[1]}, auto;`;
	// Fetch every frame up front so the first loop doesn't flash the default cursor.
	for (const [url] of frames) new Image().src = url;
	const total = frames.reduce((sum, [, ms]) => sum + ms, 0);
	let at = 0;
	const steps = frames.map(([url, ms]) => {
		const step = `${(at / total) * 100}% { ${cursor(url)} }`;
		at += ms;
		return step;
	});
	const style = document.createElement('style');
	style.textContent =
		frames.length === 1
			? `html, dialog { ${cursor(frames[0][0])} }`
			: `@keyframes page-cursor { ${steps.join(' ')} } ` +
				`html, dialog { ${cursor(frames[0][0])} animation: page-cursor ${total}ms step-end infinite; }`;
	style.textContent += ' @layer components { html * { cursor: inherit; } }';
	document.head.appendChild(style);
	return () => style.remove();
}
