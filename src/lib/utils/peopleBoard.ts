/**
 * The Projects people board (`[data-people-board]`) stretches with the row,
 * so card expand/collapse and filtering change its height. Its view-transition
 * snapshots must not overlap (a short "new" over a tall "old" moves out of
 * step), so we record which way it went and the CSS draws only one of them:
 * the new one when growing, the old one when shrinking.
 *
 * Call before starting the transition; call the returned function inside the
 * update callback, after the DOM has updated.
 */
export function trackPeopleBoard(): () => void {
	const board = document.querySelector<HTMLElement>('[data-people-board]');
	const before = board?.offsetHeight ?? 0;
	return () => {
		const after = board?.offsetHeight ?? 0;
		document.documentElement.dataset.peopleBoard = after < before ? 'shrink' : 'grow';
	};
}
