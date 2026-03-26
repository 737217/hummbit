// With the new API selectors are defined next to store init.
// Keeping this file for demonstration purposes only.
export type User = { name: string; age: number };
export const userSelector = (state: { user: User }) => state.user;
