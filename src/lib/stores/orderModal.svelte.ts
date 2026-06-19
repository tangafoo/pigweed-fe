// Shared open-state for the egg-order modal. The modal itself is rendered once
// in the root layout (OrderEggsModal.svelte); any "Order Eggs" trigger anywhere
// in the app (produce section, FarmStory, Footer) just flips `open`.
export const orderModal = $state({ open: false });
