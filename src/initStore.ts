import {
  createStore,
  type NextStateUpdater,
  type Patch,
  type Store,
  type Updater,
} from "./store";
import { createDevtoolsAdapter, resolveDevtoolsOptions } from "./devtools";
import type {
  AfterUpdateInfo,
  DevtoolsEvent,
  Middleware,
  MiddlewareContext,
  MiddlewareHooks,
} from "./middleware";

export type ActionCreator = <Fn extends (...args: any[]) => any>(
  name: string,
  fn: Fn,
) => Fn;

export type StoreApi<S extends object> = {
  getState(): Readonly<S>;
  /**
   * Replace the entire root state.
   */
  setState(input: S | NextStateUpdater<S>): Promise<void>;
  /**
   * Back-compat root merge.
   */
  mergeState(input: Patch<S> | Updater<S>): Promise<void>;
  actionCreator: ActionCreator;
};

export type Selector<S extends object, T> = (state: Readonly<S>) => T;

export type InitStoreConfig<
  S extends object,
  A extends Record<string, (...args: any[]) => any>,
  Sel extends Record<string, Selector<S, any>>,
> = {
  initialState: S;
  actions: (api: StoreApi<S>) => A;
  selectors: Sel;
  devtools?: boolean | { enabled?: boolean; name?: string };
  middleware?: Middleware<S>[];
  /**
   * If true, the root state object is frozen after each update.
   * Defaults to true (same behavior as the existing store).
   */
  freeze?: boolean;
};

export type InitializedStore<
  S extends object,
  A extends Record<string, (...args: any[]) => any>,
  Sel extends Record<string, Selector<S, any>>,
> = Store<S> & {
  select<T>(selector: Selector<S, T>): T;
  actions: A;
  selectors: Sel;
};

export function initStore<
  S extends object,
  A extends Record<string, (...args: any[]) => any>,
  Sel extends Record<string, Selector<S, any>>,
>(config: InitStoreConfig<S, A, Sel>): InitializedStore<S, A, Sel> {
  const store = createStore<S>(config.initialState, {
    freeze: config.freeze,
  }) as Store<S> & {
    __replaceState(nextState: S, opts?: { silent?: boolean }): Promise<void>;
  };

  const dt = resolveDevtoolsOptions(config.devtools);
  const devtools = dt.enabled
    ? createDevtoolsAdapter<S>({ name: dt.name ?? "hummbit" })
    : null;
  let recording = true;
  let lastCommittedState: Readonly<S> = store.getState();
  const initialStateSnapshot: Readonly<S> = store.getState();
  let isTimeTraveling = false;

  const middlewareHooks: MiddlewareHooks<S>[] = [];
  const dispatchDevtoolsRaw = (event: Omit<DevtoolsEvent<S>, "state">) => {
    if (!devtools || !recording || isTimeTraveling) return;

    let fullEvent: DevtoolsEvent<S> = { ...event, state: store.getState() };
    for (const h of middlewareHooks) {
      if (h.devtoolsFilter && !h.devtoolsFilter(fullEvent)) return;
      if (h.devtoolsTransform) fullEvent = h.devtoolsTransform(fullEvent);
    }

    const actionType =
      fullEvent.type === "action"
        ? (fullEvent.name ?? "action")
        : fullEvent.type;
    devtools.send(
      { type: actionType, payload: fullEvent.payload },
      fullEvent.state,
    );
  };

  const mwCtx: MiddlewareContext<S> = {
    getState: store.getState,
    dispatchDevtools: dispatchDevtoolsRaw,
  };

  for (const mw of config.middleware ?? []) {
    middlewareHooks.push(mw(mwCtx));
  }

  if (devtools) {
    devtools.init(store.getState());
    devtools.subscribe((message) => {
      if (message.type !== "DISPATCH") return;
      const t = message.payload?.type;
      if (!t) return;

      const safeReplace = (next: S) => {
        isTimeTraveling = true;
        return store.__replaceState(next, { silent: true }).finally(() => {
          isTimeTraveling = false;
        });
      };

      if (t === "PAUSE_RECORDING") {
        recording = !recording;
        return;
      }

      if (t === "COMMIT") {
        lastCommittedState = store.getState();
        return;
      }

      if (t === "RESET") {
        void safeReplace(initialStateSnapshot as S);
        return;
      }

      if (t === "ROLLBACK") {
        void safeReplace(lastCommittedState as S);
        devtools.init(lastCommittedState);
        return;
      }

      if (t === "JUMP_TO_STATE" || t === "JUMP_TO_ACTION") {
        if (!message.state) return;
        try {
          const parsed = JSON.parse(message.state) as S;
          void safeReplace(parsed);
        } catch {
          // ignore
        }
        return;
      }

      if (t === "IMPORT_STATE") {
        const stateStr = message.state;
        if (!stateStr) return;
        try {
          const parsed = JSON.parse(stateStr) as any;
          const next = parsed?.nextLiftedState?.computedStates?.at?.(-1)?.state;
          if (next) void safeReplace(next as S);
        } catch {
          // ignore
        }
        return;
      }
    });
  }

  const runAfterUpdate = (info: AfterUpdateInfo<S>) => {
    for (const h of middlewareHooks) h.afterUpdate?.(info);
  };

  const actionCreator: ActionCreator = (name, fn) => {
    let actionFn: any = fn;
    for (const h of middlewareHooks) {
      if (h.wrapAction) actionFn = h.wrapAction(name, actionFn);
    }

    const wrapped = async (...args: any[]) => {
      const prevState = store.getState();
      const res = await actionFn(...args);
      dispatchDevtoolsRaw({ type: "action", name });
      runAfterUpdate({
        type: "action",
        name,
        prevState,
        nextState: store.getState(),
      });
      return res;
    };
    (wrapped as any).actionName = name;
    return wrapped as any;
  };

  let setStateImpl: StoreApi<S>["setState"] = async (input) => {
    const prevState = store.getState();
    await store.setState(input);
    dispatchDevtoolsRaw({ type: "setState" });
    runAfterUpdate({
      type: "setState",
      prevState,
      nextState: store.getState(),
    });
  };

  let mergeStateImpl: StoreApi<S>["mergeState"] = async (input) => {
    const prevState = store.getState();
    await store.mergeState(input);
    dispatchDevtoolsRaw({ type: "mergeState" });
    runAfterUpdate({
      type: "mergeState",
      prevState,
      nextState: store.getState(),
    });
  };

  for (const h of middlewareHooks) {
    if (h.wrapSetState)
      setStateImpl = h.wrapSetState(setStateImpl as any) as any;
    if (h.wrapMergeState)
      mergeStateImpl = h.wrapMergeState(mergeStateImpl as any) as any;
  }

  const api: StoreApi<S> = {
    getState: store.getState,
    setState: setStateImpl,
    mergeState: mergeStateImpl,
    actionCreator,
  };

  const actions = config.actions(api);
  const selectors = config.selectors;

  const select = <T>(selector: Selector<S, T>) => selector(store.getState());

  return { ...store, select, actions, selectors };
}
