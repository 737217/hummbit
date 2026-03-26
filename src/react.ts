import { useCallback, useRef, useSyncExternalStore } from "react";
import {
  configureGlobalStore,
  getState as storeGetState,
  getVersion,
  mergeState as storeMergeState,
  setState as storeSetState,
  subscribe,
} from "./store";
import type { RootState } from "hummbit";
export { initStore } from "./initStoreReact";
export type { InitializedReactStore } from "./initStoreReact";
export type {
  InitStoreConfig,
  InitStoreOptions,
  InitializedStore,
  Selector,
  StoreApi,
} from "./initStore";
export type { Listener, Patch, Store, Updater } from "./store";
export type {
  AfterUpdateInfo,
  DevtoolsEvent,
  Middleware,
  MiddlewareContext,
  MiddlewareHooks,
} from "./middleware";

export type { RootState } from "hummbit";

export { configureGlobalStore };

// We intentionally wrap `getState`/`setState` so their typings are based on
// the *public* `RootState` that consumers can extend via:
// `declare module "hummbit" { interface RootState { ... } }`.
//
// Without these wrappers, TS would use the internal RootState declaration
// emitted into a rollup chunk, and `declare module "hummbit"` wouldn't apply.
type EqualityFn<T> = (a: T, b: T) => boolean;
type SelectorFn<T> = (state: Readonly<RootState>) => T;

export function getState(): Readonly<RootState> {
  return storeGetState() as Readonly<RootState>;
}

type Patch = Partial<RootState>;
type MergeUpdater = (
  prev: Readonly<RootState>,
) => Patch | Promise<Patch> | void | Promise<void>;

type NextStateUpdater = (
  prev: Readonly<RootState>,
) => RootState | Promise<RootState> | void | Promise<void>;

export function setState(input: RootState | NextStateUpdater): Promise<void> {
  // Runtime behavior is implemented in `./store`; the typings here are
  // intentionally based on the public `RootState` (augmentable).
  return storeSetState(input as any);
}

export function mergeState(input: Patch | MergeUpdater): Promise<void> {
  return storeMergeState(input as any);
}

export function useSelector<T>(
  selectorFn: SelectorFn<T>,
  equalityFn: EqualityFn<T> = Object.is as (a: T, b: T) => boolean,
): T {
  const selectorRef = useRef<SelectorFn<T>>(selectorFn);
  selectorRef.current = selectorFn;

  const equalityRef = useRef<EqualityFn<T>>(equalityFn);
  equalityRef.current = equalityFn;

  const selectionRef = useRef<{ version: number; value: T }>({
    version: -1,
    value: undefined as unknown as T,
  });

  const getSnapshot = useCallback(() => {
    const v = getVersion();
    if (selectionRef.current.version === v) return selectionRef.current.value;

    const nextValue = selectorRef.current(getState());
    const prevValue = selectionRef.current.value;

    const eq = equalityRef.current;
    const value =
      selectionRef.current.version === -1 || !eq(prevValue, nextValue)
        ? nextValue
        : prevValue;

    selectionRef.current = { version: v, value };
    return value;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
