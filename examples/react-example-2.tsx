import { type FC, useCallback } from "react";
import { initStore } from "hummbit/react";

type State = {
  user: { name: string; age: number };
};

const store = initStore({
  initialState: { user: { name: "John", age: 1 } },
  actions: ({ setState }) => ({
    bumpAge() {
      return setState((prev) => ({
        user: { ...prev.user, age: prev.user.age + 1 },
      }));
    },
  }),
  selectors: {
    user: (s: Readonly<State>) => s.user,
  },
});

export const Main: FC = () => {
  const userReactive = store.useSelector(store.selectors.user);

  console.log("userReactive", userReactive);

  const bumpAge = useCallback(async () => {
    await store.actions.bumpAge();
  }, []);

  return (
    <div>
      <h4>Reactive (useSelector)</h4>
      <pre>{JSON.stringify(userReactive, null, 2)}</pre>
      <h4>Non-reactive (store.select)</h4>
      <pre>{JSON.stringify(store.select(store.selectors.user), null, 2)}</pre>
      <button onClick={bumpAge}>Bump age via action</button>
    </div>
  );
};
