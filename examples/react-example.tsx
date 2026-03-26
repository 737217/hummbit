import React from "react";
import { initStore } from "hummbit/react";

type State = {
  user: { name: string; age: number };
};

const store = initStore({
  initialState: {
    user: { name: "John Doe", age: 30 },
  },
  actions: ({ actionCreator, setState }) => ({
    setUser: actionCreator("setUser", (user: State["user"]) => {
      return setState((prev) => ({ ...prev, user }));
    }),
    bumpAge: actionCreator("bumpAge", () => {
      return setState((prev) => ({
        ...prev,
        user: { ...prev.user, age: prev.user.age + 1 },
      }));
    }),
    bumpAgeAsync: actionCreator("bumpAgeAsync", () => {
      return setState(async (prev) => ({
        ...prev,
        user: { ...prev.user, age: prev.user.age + 1 },
      }));
    }),
  }),
  selectors: {
    user: (s: Readonly<State>) => s.user,
  },
});

/**
 * 1) Reactive чтение: React-хук ререндерит компонент при изменениях `user`.
 */
export function UserViewReactive() {
  const user = store.useSelector(store.selectors.user);
  return <pre>{JSON.stringify(user, null, 2)}</pre>;
}

/**
 * 2) Imperative чтение через `store.getState()` (НЕ реактивно).
 * Хорошо для логов/обработчиков событий, но не для данных в UI.
 */
export function UserImperativeRead() {
  React.useEffect(() => {
    console.log("[mount snapshot]", store.getState().user);
  }, []);

  const onLogNow = () => {
    console.log("[getState now]", store.getState().user);
  };

  return (
    <div>
      <button onClick={onLogNow}>Log store.getState()</button>
    </div>
  );
}

/**
 * 3) Async сценарий: ждем завершения action, затем читаем `store.getState()`.
 */
export function UserReadAfterAsyncUpdate() {
  const user = store.useSelector(store.selectors.user);

  const bumpAgeAsync = React.useCallback(async () => {
    await store.actions.bumpAgeAsync();
    console.log("[after await action]", store.getState().user);
  }, []);

  return (
    <div>
      <pre>{JSON.stringify(user, null, 2)}</pre>
      <button onClick={bumpAgeAsync}>Bump age (async)</button>
    </div>
  );
}

/**
 * 4) Imperative update через action,
 * затем получение snapshot через `store.select` (НЕ реактивно).
 */
export function UserSetStateSyncPatchAndReadViaSelector() {
  const userReactive = store.useSelector(store.selectors.user);
  const snapshotViaSelector = store.select(store.selectors.user);

  const setToAlice = React.useCallback(async () => {
    // Важно: `store.select` — не реактивный, поэтому read не вызывает ререндер сам по себе.
    await store.actions.setUser({ name: "Alice", age: 20 });
  }, []);

  return (
    <div>
      <h4>Reactive (useSelector)</h4>
      <pre>{JSON.stringify(userReactive, null, 2)}</pre>

      <h4>Non-reactive (store.select)</h4>
      <pre>{JSON.stringify(snapshotViaSelector, null, 2)}</pre>

      <button onClick={setToAlice}>Set Alice via action</button>
    </div>
  );
}

/**
 * 5) Imperative update через action (updater),
 * затем получение snapshot через `store.select` (НЕ реактивно).
 */
export function UserBumpAgeViaUpdaterAndReadViaSelector() {
  // Показываем реактивную часть для того, чтобы компонент перерисовался
  // после update, а `store.select` оставался не реактивным источником.
  const userReactive = store.useSelector(store.selectors.user);
  const snapshotViaSelector = store.select(store.selectors.user);

  const bumpAge = React.useCallback(async () => {
    await store.actions.bumpAge();
  }, []);

  return (
    <div>
      <h4>Reactive (useSelector)</h4>
      <pre>{JSON.stringify(userReactive, null, 2)}</pre>
      <h4>Non-reactive (store.select)</h4>
      <pre>{JSON.stringify(snapshotViaSelector, null, 2)}</pre>
      <button onClick={bumpAge}>Bump age via action + store.select</button>
    </div>
  );
}
