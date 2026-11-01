/**
 * Styled text that stays real text (selectable, translatable, read by screen
 * readers). A plain string, or a run of spans where each span can carry marks.
 * Rendered by `components/ui/RichText.svelte`.
 */
export type RichMark =
	| 'italic'
	| 'underline'
	| 'handwriting'
	| 'accent'
	| 'green'
	| 'blue'
	| 'yolk';
export type RichSpan = string | { text: string; marks: RichMark[] };
export type RichText = string | RichSpan[];

/** Full class strings so Tailwind picks them up. */
export const RICH_MARK_CLASS: Record<RichMark, string> = {
	italic: 'italic',
	underline: 'underline decoration-wavy underline-offset-4',
	handwriting: 'font-homemade-apple',
	accent: 'text-olf-coral',
	green: 'text-olf-sage',
	blue: 'text-olf-blue',
	yolk: 'text-olf-yolk'
};
