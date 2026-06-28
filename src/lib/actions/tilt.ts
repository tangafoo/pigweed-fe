import type { Action } from 'svelte/action';

/**
 * GSAP pointer-tilt for "trading card" surfaces. Rotates the node in 3D toward
 * the cursor with an eased response (near-flat in the middle, ramping toward the
 * edges), lifts it slightly on hover, and exposes `--mx`/`--my`/`--glare` CSS
 * vars so a child overlay can paint a cursor-tracking holo glare.
 *
 * Mouse only (touch is left flat) and disabled under prefers-reduced-motion.
 * gsap is lazy-imported to match the rest of the app (keeps it out of SSR).
 */
export const tilt: Action<
	HTMLElement,
	{ max?: number; scale?: number; perspective?: number } | undefined
> = (node, params) => {
	const max = params?.max ?? 12;
	const scaleUp = params?.scale ?? 1.03;
	const perspective = params?.perspective ?? 900;

	let cleanup = () => {};
	const reduce =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	if (!reduce) {
		(async () => {
			const { gsap } = await import('gsap');
			gsap.set(node, { transformPerspective: perspective, transformOrigin: 'center' });
			const rotY = gsap.quickTo(node, 'rotationY', { duration: 0.6, ease: 'power3' });
			const rotX = gsap.quickTo(node, 'rotationX', { duration: 0.6, ease: 'power3' });
			const scl = gsap.quickTo(node, 'scale', { duration: 0.4, ease: 'power2' });
			// Flatten the centre so the response only bites near the borders.
			const curve = (v: number) => Math.sign(v) * Math.abs(v) ** 2.4;

			const move = (e: PointerEvent) => {
				if (e.pointerType !== 'mouse') return;
				const r = node.getBoundingClientRect();
				const px = (e.clientX - r.left) / r.width;
				const py = (e.clientY - r.top) / r.height;
				rotY(curve((px - 0.5) * 2) * max);
				rotX(-curve((py - 0.5) * 2) * max);
				node.style.setProperty('--mx', `${px * 100}%`);
				node.style.setProperty('--my', `${py * 100}%`);
				node.style.setProperty('--glare', '1');
			};
			const enter = (e: PointerEvent) => e.pointerType === 'mouse' && scl(scaleUp);
			const leave = () => {
				rotY(0);
				rotX(0);
				scl(1);
				node.style.setProperty('--glare', '0');
			};

			node.addEventListener('pointermove', move);
			node.addEventListener('pointerenter', enter);
			node.addEventListener('pointerleave', leave);
			cleanup = () => {
				node.removeEventListener('pointermove', move);
				node.removeEventListener('pointerenter', enter);
				node.removeEventListener('pointerleave', leave);
			};
		})();
	}

	return { destroy: () => cleanup() };
};
