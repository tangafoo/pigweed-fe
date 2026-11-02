// Custom cursor for a single page: mountAniCursor for animated .ani files
// (Farmdex starfish, Volunteer horse), mountCursor for plain images or PNG
// frames (the Projects butterflies).
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

// Adds the page's cursor CSS plus the inherit rule; returns the cleanup.
// The cursor goes on <dialog> too: a modal dialog makes the page (incl.
// <html>) inert, and inert elements stop matching :hover, so an html-only
// animation would pause while the overlay is open.
const PAGE = ':is(html, dialog)';
function injectCursorStyle(css: string): () => void {
	const style = document.createElement('style');
	style.textContent = css + ' @layer components { html * { cursor: inherit; } }';
	document.head.appendChild(style);
	return () => style.remove();
}

export function mountAniCursor(url: string, { centerHotspot = false } = {}): () => void {
	let remove: (() => void) | undefined;
	let left = false; // navigated away before the fetch finished
	Promise.all([import('ani-cursor'), fetch(url).then((r) => r.arrayBuffer())])
		.then(([{ convertAniBinaryToCSS }, buf]) => {
			if (left) return;
			const raw = new Uint8Array(buf);
			// ani-cursor appends `:hover` to the selector, hence :is().
			remove = injectCursorStyle(
				convertAniBinaryToCSS(PAGE, centerHotspot ? centerHotspots(raw) : raw)
			);
		})
		.catch(() => {}); // cosmetic — fall back to the normal cursor
	return () => {
		left = true;
		remove?.();
	};
}

/**
 * Cursor from plain images (.cur, single-size .ico, or PNG frames) for a
 * single page, same inheritance as above. Browsers show these natively.
 * Keep them small: Chrome ignores cursors over 128px, and from a multi-size
 * .ico it may pick the 256px image. A url = a still cursor; a list of
 * `[url, ms]` frames = an animation looping through them.
 * `hotspot` is the click point; leave it out to use the file's own (a .cur
 * has one; anything else then clicks at its top-left).
 */
let cursorId = 0;
export function mountCursor(
	image: string | [url: string, ms: number][],
	{ hotspot }: { hotspot?: [number, number] } = {}
): () => void {
	const frames = typeof image === 'string' ? [[image, 0] as const] : image;
	const spot = hotspot ? ` ${hotspot[0]} ${hotspot[1]}` : '';
	const cursor = (url: string) => `cursor: url('${url}')${spot}, auto;`;
	// Unique per mount, so an overlapping mount/cleanup can't clobber it.
	const name = `page-cursor-${++cursorId}`;
	// Fetch every frame up front so the first loop doesn't flash the default cursor.
	for (const url of new Set(frames.map(([url]) => url))) new Image().src = url;
	const total = frames.reduce((sum, [, ms]) => sum + ms, 0);
	let at = 0;
	const steps = frames.map(([url, ms]) => {
		const step = `${(at / total) * 100}% { ${cursor(url)} }`;
		at += ms;
		return step;
	});
	return injectCursorStyle(
		frames.length === 1
			? `${PAGE} { ${cursor(frames[0][0])} }`
			: `@keyframes ${name} { ${steps.join(' ')} } ` +
					`${PAGE} { ${cursor(frames[0][0])} animation: ${name} ${total}ms step-end infinite; }`
	);
}
