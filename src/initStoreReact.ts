import {
  initStore as initStoreBase,
  type InitStoreConfig,
  type InitializedStore,
} from "./initStore";
import { createUseSelector } from "./reactStore";

export type InitializedReactStore<
  S extends object,
  A extends Record<string, (...args: any[]) => any>,
  Sel extends Record<string, (state: Readonly<S>) => any>,
> = InitializedStore<S, A, Sel> & {
  useSelector: ReturnType<typeof createUseSelector<S>>;
};

export function initStore<
  S extends object,
  A extends Record<string, (...args: any[]) => any>,
  Sel extends Record<string, (state: Readonly<S>) => any>,
>(config: InitStoreConfig<S, A, Sel>): InitializedReactStore<S, A, Sel> {
  const store = initStoreBase(config);
  const useSelector = createUseSelector(store);
  return { ...store, useSelector };
}
