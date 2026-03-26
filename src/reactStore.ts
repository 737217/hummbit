import { useCallback, useRef, useSyncExternalStore } from "react";
import type { Listener, Store } from "./store";

type EqualityFn<T> = (a: T, b: T) => boolean;
type SelectorFn<S extends object, T> = (state: Readonly<S>) => T;

export function createUseSelector<S extends object>(store: Store<S>) {
  return function useSelector<T>(
    selectorFn: SelectorFn<S, T>,
    equalityFn: EqualityFn<T> = Object.is as (a: T, b: T) => boolean,
  ): T {
    const selectorRef = useRef<SelectorFn<S, T>>(selectorFn);
    selectorRef.current = selectorFn;

    const equalityRef = useRef<EqualityFn<T>>(equalityFn);
    equalityRef.current = equalityFn;

    const selectionRef = useRef<{ version: number; value: T }>({
      version: -1,
      value: undefined as unknown as T,
    });

    const subscribe = useCallback(
      (listener: Listener) => store.subscribe(listener),
      [store],
    );

    const getSnapshot = useCallback(() => {
      const v = store.getVersion();
      if (selectionRef.current.version === v) return selectionRef.current.value;

      const nextValue = selectorRef.current(store.getState());
      const prevValue = selectionRef.current.value;

      const eq = equalityRef.current;
      const value =
        selectionRef.current.version === -1 || !eq(prevValue, nextValue)
          ? nextValue
          : prevValue;

      selectionRef.current = { version: v, value };
      return value;
    }, [store]);

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  };
}
