# Redux DevTools in hummbit

This guide explains how to connect **Redux DevTools** to `hummbit` stores.

## 1) Install the browser extension

- **Chrome / Edge**: install “Redux DevTools” extension
- **Firefox**: install “Redux DevTools” add-on

After installing, open your app and then open the DevTools panel → **Redux** tab.

## 2) Default behavior (dev vs prod)

`hummbit` enables DevTools **automatically in non-production**:

- enabled when `process.env.NODE_ENV !== "production"`
- disabled when `process.env.NODE_ENV === "production"`

If your runtime doesn’t expose `process.env.NODE_ENV`, use an explicit override (see below).

## 3) Per-store configuration (`initStore`)

### Disable

```ts
import { initStore } from "hummbit";

const store = initStore({
  initialState: {
    /* ... */
  },
  devtools: false,
  actions: (api) => ({
    /* ... */
  }),
  selectors: {
    /* ... */
  },
});
```

### Force enable

```ts
const store = initStore({
  initialState: {
    /* ... */
  },
  devtools: true,
  actions: (api) => ({
    /* ... */
  }),
  selectors: {
    /* ... */
  },
});
```

### Custom DevTools instance name

```ts
const store = initStore({
  initialState: {
    /* ... */
  },
  devtools: { name: "MyStore" },
  actions: (api) => ({
    /* ... */
  }),
  selectors: {
    /* ... */
  },
});
```

## 4) Global singleton configuration (`hummbit` / `hummbit/react`)

If you’re using the global singleton API (`getState` / `setState` / `mergeState` / `useSelector`),
configure it once during app startup:

```ts
import { configureGlobalStore } from "hummbit";

configureGlobalStore({
  devtools: false, // disable
  // devtools: true, // force enable
  // devtools: { name: "hummbit(global)" }, // custom name
});
```

## 5) What you’ll see in Redux DevTools

- Stores created via `initStore(...)` appear as `hummbit` (or your custom `devtools.name`).
- The global singleton appears as `hummbit(global)` (or your custom `devtools.name` set via `configureGlobalStore`).

## 6) Time-travel / supported commands

`hummbit` supports common DevTools time-travel commands:

- `JUMP_TO_STATE` / `JUMP_TO_ACTION`
- `RESET`
- `ROLLBACK`
- `COMMIT`
- `IMPORT_STATE`
- `PAUSE_RECORDING`

Notes:

- During time-travel jumps, state is replaced **silently** (no extra actions are emitted back into the timeline).
- Prefer **serializable** state (plain objects/arrays/primitives) for best DevTools experience.

## 7) Troubleshooting

### DevTools tab is empty

- Ensure the extension is installed and enabled.
- Ensure you’re running in a non-production environment, or set `devtools: true`.

### DevTools enabled on production build

- Ensure your production build sets `process.env.NODE_ENV` to `"production"`, or set `devtools: false`.
