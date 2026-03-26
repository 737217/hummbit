import type { RootState } from "./index";

export type { RootState };

export type SelectorFn<T> = (state: RootState) => T;

export type EqualityFn<T> = (a: T, b: T) => boolean;
