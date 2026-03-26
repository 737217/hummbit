# hummbit

Immutable state with **typed `initStore`**: you declare `initialState`, **actions** (updates), and **selectors** (reads). Optional React hook bound to that store — **no Provider**.

## Install

```sh
yarn add hummbit
```

Peer dependency: **React ≥ 18** (only if you use `hummbit/react`).

## Package size (release)

Release builds are configured to **not include sourcemaps**, so they don't inflate the published npm package size.

```sh
yarn build:release
npm pack --dry-run
```

To prevent regressions, run:

```sh
yarn size:check
```

You can override the limit (bytes) with `MAX_UNPACKED_BYTES`, e.g.:

```sh
MAX_UNPACKED_BYTES=90000 yarn size:check
```

---

## Store API (`initStore`)

`initStore` returns a store instance with:

- **`getState()`** — current snapshot
- **`setState(nextState | updater)`** — **replace** the entire root state; returns **`Promise<void>`** (see [Update semantics](#update-semantics))
- **`mergeState(patch | updater)`** — back-compat shallow merge at the **root** (`{ ...prev, ...patch }`); returns **`Promise<void>`**
- **`getVersion()`** — increments after each applied update (used internally for subscriptions)
- **`subscribe(listener)`** — called after each update; returns unsubscribe
- **`select(selector)`** — one-off read through a selector (not subscribed)
- **`actions`** — object you build from `actions: ({ getState, setState, mergeState, actionCreator }) => …`
- **`selectors`** — your selector map

```ts
import { initStore } from "hummbit";

type State = {
  user: { name: string; age: number };
};

const store = initStore({
  initialState: {
    user: { name: "John Doe", age: 30 },
  },
  actions: ({ actionCreator, mergeState, setState }) => ({
    setUser: actionCreator("setUser", (user: State["user"]) => {
      // Back-compat root merge update
      return mergeState({ user });
    }),
    bumpAge: actionCreator("bumpAge", () => {
      // Full root replace update
      return setState((prev) => ({
        ...prev,
        user: { ...prev.user, age: prev.user.age + 1 },
      }));
    }),
  }),
  selectors: {
    user: (s) => s.user,
  },
});

// One-off snapshot (not subscribed to updates)
store.select(store.selectors.user);

await store.actions.bumpAge();
```

### `freeze`

By default the **root state object is frozen** after each update (`Object.freeze`). To disable (e.g. for debugging), pass `freeze: false`:

```ts
const store = initStore({
  initialState: { count: 0 },
  freeze: false,
  actions: ({ setState }) => ({
    inc: () => setState((s) => ({ count: s.count + 1 })),
  }),
  selectors: { count: (s) => s.count },
});
```

### Update semantics

- **`setState` always returns `Promise<void>`** — updates run on an **internal queue** and are applied **in call order** (including async updaters).
- **`setState` replaces the root**: when you call `setState`, you must return/provide the full next root state (often via `setState(prev => ({ ...prev, ... }))`).
- **`mergeState` shallow-merges at the root**: `mergeState({ user: nextUser })` replaces `state.user` at the top level; nested objects are **not** deep-merged unless you do it yourself.

Examples:

```ts
// Replace root
await store.setState((prev) => ({ ...prev, user: { name: "Ann", age: 25 } }));

// Merge at root (back-compat)
await store.mergeState({ user: { name: "Bob", age: 30 } });
```

### Using `getState`

`getState()` returns the **current** immutable snapshot. It is **not** reactive: nothing re-runs when state changes unless you also `subscribe` or use `useSelector` in React.

**From an `initStore` instance** — read the whole tree or a field:

```ts
const snapshot = store.getState();
const age = store.getState().user.age;
```

**Inside `actions`** — `StoreApi` exposes `getState`, `setState`, `mergeState`, and `actionCreator`:

```ts
actions: ({ getState, setState, actionCreator }) => ({
  bumpIfAdult() {
    const { user } = getState();
    if (user.age < 18) return;
    return actionCreator("bumpIfAdult", () =>
      setState((prev) => ({ ...prev, user: { ...user, age: user.age + 1 } })),
    )();
  },
}),
```

**After an update** — if you need the state **after** a queued update finishes, `await` `setState` (or your action) first, then read:

```ts
await store.setState((prev) => ({ ...prev, user: { name: "Ann", age: 25 } }));
console.log(store.getState().user);
```

**Global store** (`hummbit` / `hummbit/react`) — same idea: import `getState` and call it anywhere the default singleton is used (with `RootState` augmented for types):

```ts
import { getState } from "hummbit";

const user = getState().user;
```

**In React** — use `getState()` in event handlers, callbacks, or effects when you only need a **one-off** read. For values that should **drive rendering**, prefer `useSelector` / `store.useSelector` so the component updates when state changes.

---

## React (`hummbit/react`)

The same config as `hummbit`, plus **`useSelector`** on the store instance (backed by `useSyncExternalStore`).

```tsx
import { initStore } from "hummbit/react";

const store = initStore({
  initialState: { user: { name: "John", age: 1 } },
  actions: ({ actionCreator, setState }) => ({
    bumpAge: actionCreator("bumpAge", () =>
      setState((prev) => ({
        ...prev,
        user: { ...prev.user, age: prev.user.age + 1 },
      })),
    ),
  }),
  selectors: {
    user: (s) => s.user,
  },
});

function User() {
  const user = store.useSelector(store.selectors.user);
  return <pre>{JSON.stringify(user, null, 2)}</pre>;
}
```

### `useSelector` and equality

Both **instance** `store.useSelector` and the **global** `useSelector` from `hummbit/react` accept an optional **second argument**: an equality function (default **`Object.is`**). If it returns `true`, the component does not re-render even if the store notified subscribers.

```tsx
const id = store.useSelector(
  (s) => s.user.id,
  (a, b) => a === b,
);
```

### Global singleton API

You can still use **`getState`**, **`setState`**, **`mergeState`**, and **`useSelector`** from `hummbit/react` against the **default** global store if you augment **`RootState`** ([Legacy](#legacy-global-singleton--rootstate-augmentation)).

---

## Async updates

```ts
await store.actions.someAsyncAction();

// or inside actions:
actions: ({ setState }) => ({
  async load() {
    await setState(async (prev) => {
      const data = await fetchData();
      return { ...prev, data };
    });
  },
}),
```

---

## Redux DevTools + time-travel

If the Redux DevTools extension is installed, `hummbit` connects automatically **in non-production** (`NODE_ENV !== "production"`), unless you override it.

### Per-store override (`initStore`)

```ts
initStore({
  initialState: { /* ... */ },
  devtools: false, // disable
  // devtools: true, // force enable
  // devtools: { name: "MyStore" }, // custom name
  actions: (...) => ({ /* ... */ }),
  selectors: { /* ... */ },
});
```

### Global singleton override

```ts
import { configureGlobalStore } from "hummbit";

configureGlobalStore({
  devtools: false,
  // devtools: { enabled: true, name: "hummbit(global)" },
});
```

Stores show up in DevTools as:

- **Store instances** created via `initStore(...)`: `hummbit` (or your custom name)
- **Global singleton**: `hummbit(global)` (or your custom name)

Supported devtools commands:

- `JUMP_TO_STATE` / `JUMP_TO_ACTION`
- `RESET`
- `ROLLBACK`
- `COMMIT`
- `IMPORT_STATE`
- `PAUSE_RECORDING`

Notes:

- During time-travel jumps, state is replaced silently (no extra actions are emitted back into the devtools timeline).
- For best results, keep your state serializable (plain objects/arrays/primitives).

---

## Middleware

You can add middleware to extend behavior around actions, state updates, after-update hooks, and DevTools dispatch.

Example:

```ts
import { initStore } from "hummbit";
import type { Middleware } from "hummbit";

type State = { count: number };

const logger: Middleware<State> = (ctx) => ({
  wrapAction:
    (name, next) =>
    async (...args) => {
      const res = await next(...args);
      console.log("action", name, ctx.getState());
      return res;
    },
});

const store = initStore({
  initialState: { count: 0 },
  middleware: [logger],
  actions: ({ actionCreator, setState }) => ({
    inc: actionCreator("inc", () =>
      setState((s) => ({ ...s, count: s.count + 1 })),
    ),
  }),
  selectors: { count: (s: Readonly<State>) => s.count },
});
```

Global singleton middleware:

```ts
import { configureGlobalStore } from "hummbit";
import type { Middleware } from "hummbit";

type Root = { count: number };

const logger: Middleware<Root> = (ctx) => ({
  wrapAction:
    (name, next) =>
    async (...args) => {
      const res = await next(...args);
      console.log("action", name, ctx.getState());
      return res;
    },
});

configureGlobalStore({
  middleware: [logger],
});
```

---

## TypeScript exports

From **`hummbit`**: `initStore`, `getState`, `setState`, `mergeState`, `selector`, and types such as `StoreApi`, `InitStoreConfig`, `InitializedStore`, `Selector`, `RootState`, plus `Store`, `Patch`, `Updater`, `Listener`.

From **`hummbit/react`**: `initStore`, `InitializedReactStore`, the same store-related types as above, plus `useSelector`, `getState`, `setState`, `mergeState`, `RootState`.

---

## Legacy: global singleton + `RootState` augmentation

If you use `getState` / `setState` / **`selector`** from `hummbit` (or `useSelector` from `hummbit/react`) **without** `initStore`, typings come from an augmentable **`RootState`**:

```ts
declare module "hummbit" {
  interface RootState {
    user: { name: string; age: number };
  }
}
```

```ts
import { getState, selector, setState } from "hummbit";

await setState((prev) => ({ ...prev, user: { name: "John Doe", age: 30 } }));
const user = selector((state) => state.user);
```

**`selector(fn)`** reads the current snapshot once; it does **not** subscribe to updates (unlike `useSelector` in React).

### Migration

- If you previously used `setState({ ...patch })` for root-merge, switch to **`mergeState({ ...patch })`**.
- If you want the replace-first style, use `setState(prev => ({ ...prev, ... }))` and return the full next root state.

For new code, prefer **`initStore`** so the state shape is declared next to the store and does not depend on global augmentation.
