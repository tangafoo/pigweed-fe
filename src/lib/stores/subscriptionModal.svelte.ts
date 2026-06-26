// Shared open-state for the subscription modal. The modal is rendered once in
// the root layout (SubscriptionModal.svelte); any "Subscribe" trigger anywhere
// in the app just flips `open` — same pattern as orderModal.
export const subscriptionModal = $state({ open: false });
