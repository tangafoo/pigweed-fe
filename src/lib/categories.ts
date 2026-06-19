import type { PostCategory } from '@meteorclass/pigweed-contract';

// Single source of truth for category-flair colours. Used by the create form,
// the /posts filter chips, and PostCard so they never drift. Full class strings
// (not interpolated fragments) so Tailwind picks them up at build. White text
// reads on all four backgrounds.
export const CATEGORY_COLOR: Record<PostCategory, string> = {
	EGGS: 'bg-olf-yolk text-white',
	VEGGIES: 'bg-olf-darkgreen text-white',
	FRUITS: 'bg-olf-rose text-white',
	ANIMALS: 'bg-olf-darkbrown text-white'
};
