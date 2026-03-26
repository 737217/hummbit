import { configureGlobalStore, getState, mergeState, setState } from "./store";
import type { SelectorFn } from "./types";
export { initStore } from "./initStore";
export type {
  InitStoreConfig,
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

// Augmentable global state shape:
// Consumers can extend this via:
// `declare module "hummbit" { interface RootState { ... } }`
export interface RootState {}

export { getState, setState, mergeState, configureGlobalStore };

/**
 * Vanilla selector: reads from the current immutable snapshot.
 */
export function selector<T>(selectorFn: SelectorFn<T>): T {
  return selectorFn(getState());
}
