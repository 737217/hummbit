export type DevtoolsEvent<S extends object> = {
  type: "action" | "setState" | "mergeState";
  name?: string;
  payload?: any;
  state: Readonly<S>;
};

export type AfterUpdateInfo<S extends object> = {
  type: "action" | "setState" | "mergeState";
  name?: string;
  prevState?: Readonly<S>;
  nextState: Readonly<S>;
};

export type MiddlewareContext<S extends object> = {
  getState(): Readonly<S>;
  dispatchDevtools(event: Omit<DevtoolsEvent<S>, "state">): void;
};

export type MiddlewareHooks<S extends object> = {
  wrapAction?: <Fn extends (...args: any[]) => any>(
    name: string,
    next: Fn,
  ) => Fn;
  wrapSetState?: (
    next: (input: S | ((prev: Readonly<S>) => any)) => Promise<void>,
  ) => (input: S | ((prev: Readonly<S>) => any)) => Promise<void>;
  wrapMergeState?: (
    next: (input: any) => Promise<void>,
  ) => (input: any) => Promise<void>;
  afterUpdate?: (info: AfterUpdateInfo<S>) => void;
  devtoolsFilter?: (event: DevtoolsEvent<S>) => boolean;
  devtoolsTransform?: (event: DevtoolsEvent<S>) => DevtoolsEvent<S>;
};

export type Middleware<S extends object> = (
  ctx: MiddlewareContext<S>,
) => MiddlewareHooks<S>;

export function compose2<A>(outer: (next: A) => A, inner: A): A {
  return outer(inner);
}
