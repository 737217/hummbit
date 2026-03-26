import { initStore } from "hummbit";

const store = initStore({
  initialState: { user: { name: "", age: 0 } },
  actions: ({ setState }) => ({
    setUser(user) {
      return setState({ user });
    },
    bumpAge() {
      return setState((prev) => ({
        user: { ...prev.user, age: prev.user.age + 1 },
      }));
    },
  }),
  selectors: {
    user: (s) => s.user,
  },
});

console.log("initial user:", store.select(store.selectors.user));

await store.actions.setUser({
  name: "John Doe",
  age: 30,
});

console.log("updated user:", store.select(store.selectors.user));
console.log("raw state:", store.getState());
