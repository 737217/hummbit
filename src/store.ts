import type { RootState } from "./types";
import {
  createDevtoolsAdapter,
  resolveDevtoolsOptions,
  type DevtoolsConfig,
} from "./devtools";
import type {
  AfterUpdateInfo,
  DevtoolsEvent,
  Middleware,
  MiddlewareContext,
  MiddlewareHooks,
} from "./middleware";

export type Listener = () => void;

export type Patch<S extends object> = Partial<S>;
export type Updater<S extends object> = (
  prev: Readonly<S>,
) => Patch<S> | Promise<Patch<S>> | void | Promise<void>;

export type NextStateUpdater<S extends object> = (
  prev: Readonly<S>,
) => S | Promise<S> | void | Promise<void>;

export type Store<S extends object> = {
  getState(): Readonly<S>;
  getVersion(): number;
  subscribe(listener: Listener): () => void;
  /**
   * Replace the entire root state.
   */
  setState(input: S | NextStateUpdater<S>): Promise<void>;
  /**
   * Back-compat root merge.
   */
  mergeState(input: Patch<S> | Updater<S>): Promise<void>;
};

export type StoreInternalApi<S extends object> = Store<S> & {
  __replaceState(nextState: S, opts?: { silent?: boolean }): Promise<void>;
};

export function createStore<S extends object>(
  initialState: S,
  options?: { freeze?: boolean },
): Store<S> {
  const freeze = options?.freeze ?? true;

  const freezeRoot = (obj: S): Readonly<S> =>
    (freeze ? Object.freeze(obj) : obj) as Readonly<S>;

  let state: Readonly<S> = freezeRoot({ ...initialState });
  let version = 0;

  const listeners = new Set<Listener>();

  // Ensures async updates are applied strictly in call order.
  let queue: Promise<void> = Promise.resolve();

  const getState = () => state;
  const getVersion = () => version;

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const notify = () => {
    for (const l of listeners) l();
  };

  const applyReplace = (nextState: S) => {
    const next = freezeRoot(nextState);
    state = next;
    version += 1;
    notify();
  };

  const __replaceState = (nextState: S, _opts?: { silent?: boolean }) => {
    queue = queue.then(async () => {
      applyReplace(nextState);
    });

    return queue;
  };

  const setState = (input: S | NextStateUpdater<S>) => {
    queue = queue.then(async () => {
      const nextState: S | void =
        typeof input === "function"
          ? await (input as NextStateUpdater<S>)(state)
          : input;

      if (!nextState) return;
      applyReplace(nextState);
    });

    return queue;
  };

  const mergeState = (input: Patch<S> | Updater<S>) => {
    queue = queue.then(async () => {
      const patch: Patch<S> | void =
        typeof input === "function"
          ? await (input as Updater<S>)(state)
          : input;

      if (!patch) return;

      const next = { ...(state as S), ...patch } as S;
      applyReplace(next);
    });

    return queue;
  };

  return {
    getState,
    getVersion,
    subscribe,
    setState,
    mergeState,
    // Internal escape hatch for devtools/time-travel.
    // Not part of the public docs/API contract.
    __replaceState,
  } as unknown as StoreInternalApi<S>;
}

// Back-compat: keep the existing singleton store behavior.
const defaultStore = createStore<RootState>(
  {} as RootState,
) as StoreInternalApi<RootState>;

export function getState(): Readonly<RootState> {
  return defaultStore.getState();
}
export function getVersion(): number {
  return defaultStore.getVersion();
}
export function subscribe(listener: Listener): () => void {
  return defaultStore.subscribe(listener);
}
export function __replaceState(
  nextState: RootState,
  opts?: { silent?: boolean },
) {
  return defaultStore.__replaceState(nextState, opts);
}

type GlobalStoreConfig = {
  devtools?: DevtoolsConfig;
  devtoolsEvents?: {
    /**
     * If true, `setState` updates won't appear as separate entries in Redux DevTools.
     * This only affects DevTools logging; it does not change store behavior.
     */
    hideSetState?: boolean;
    /**
     * If true, `mergeState` updates won't appear as separate entries in Redux DevTools.
     * This only affects DevTools logging; it does not change store behavior.
     */
    hideMergeState?: boolean;
  };
  middleware?: Middleware<RootState>[];
};

const globalKey = "__hummbit_global_store_config__";
const gAny: any = typeof globalThis !== "undefined" ? (globalThis as any) : {};
const globalConfig: GlobalStoreConfig =
  gAny[globalKey] ?? (gAny[globalKey] = {});

export function configureGlobalStore(config: GlobalStoreConfig) {
  globalConfig.devtools = config.devtools;
  globalConfig.middleware = config.middleware;
  // if devtools were already initialized we don't re-wire dynamically;
  // this is intended to be called during app startup.
}

let globalWired = false;

function ensureGlobalWired() {
  if (globalWired) return;
  globalWired = true;

  const dt = resolveDevtoolsOptions(globalConfig.devtools);
  const devtools = dt.enabled
    ? createDevtoolsAdapter<RootState>({ name: dt.name ?? "hummbit(global)" })
    : null;

  let recording = true;
  let lastCommittedState: Readonly<RootState> = defaultStore.getState();
  const initialStateSnapshot: Readonly<RootState> = defaultStore.getState();
  let isTimeTraveling = false;

  const middlewareHooks: MiddlewareHooks<RootState>[] = [];
  const dispatchDevtoolsRaw = (
    event: Omit<DevtoolsEvent<RootState>, "state">,
  ) => {
    if (!devtools || !recording || isTimeTraveling) return;
    if (event.type === "setState" && globalConfig.devtoolsEvents?.hideSetState)
      return;
    if (
      event.type === "mergeState" &&
      globalConfig.devtoolsEvents?.hideMergeState
    )
      return;
    let fullEvent: DevtoolsEvent<RootState> = {
      ...event,
      state: defaultStore.getState(),
    };
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

  const mwCtx: MiddlewareContext<RootState> = {
    getState: defaultStore.getState,
    dispatchDevtools: dispatchDevtoolsRaw,
  };
  for (const mw of globalConfig.middleware ?? []) {
    middlewareHooks.push(mw(mwCtx));
  }

  const runAfterUpdate = (info: AfterUpdateInfo<RootState>) => {
    for (const h of middlewareHooks) h.afterUpdate?.(info);
  };

  if (devtools) {
    devtools.init(defaultStore.getState());
    devtools.subscribe((message) => {
      if (message.type !== "DISPATCH") return;
      const t = message.payload?.type;
      if (!t) return;

      const safeReplace = (next: RootState) => {
        isTimeTraveling = true;
        return defaultStore
          .__replaceState(next, { silent: true })
          .finally(() => {
            isTimeTraveling = false;
          });
      };

      if (t === "PAUSE_RECORDING") {
        recording = !recording;
        return;
      }
      if (t === "COMMIT") {
        lastCommittedState = defaultStore.getState();
        return;
      }
      if (t === "RESET") {
        void safeReplace(initialStateSnapshot as RootState);
        return;
      }
      if (t === "ROLLBACK") {
        void safeReplace(lastCommittedState as RootState);
        devtools.init(lastCommittedState);
        return;
      }
      if (t === "JUMP_TO_STATE" || t === "JUMP_TO_ACTION") {
        if (!message.state) return;
        try {
          const parsed = JSON.parse(message.state) as RootState;
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
          if (next) void safeReplace(next as RootState);
        } catch {
          // ignore
        }
        return;
      }
    });
  }

  const baseSetState = defaultStore.setState.bind(defaultStore);
  const baseMergeState = defaultStore.mergeState.bind(defaultStore);

  let setStateImpl = async (input: any) => {
    const prevState = defaultStore.getState();
    await baseSetState(input);
    dispatchDevtoolsRaw({ type: "setState" });
    runAfterUpdate({
      type: "setState",
      prevState,
      nextState: defaultStore.getState(),
    });
  };
  let mergeStateImpl = async (input: any) => {
    const prevState = defaultStore.getState();
    await baseMergeState(input);
    dispatchDevtoolsRaw({ type: "mergeState" });
    runAfterUpdate({
      type: "mergeState",
      prevState,
      nextState: defaultStore.getState(),
    });
  };

  for (const h of middlewareHooks) {
    if (h.wrapSetState)
      setStateImpl = h.wrapSetState(setStateImpl as any) as any;
    if (h.wrapMergeState)
      mergeStateImpl = h.wrapMergeState(mergeStateImpl as any) as any;
  }

  (defaultStore as any).setState = setStateImpl;
  (defaultStore as any).mergeState = mergeStateImpl;
}

export function setState(
  input: RootState | NextStateUpdater<RootState>,
): Promise<void> {
  ensureGlobalWired();
  return (defaultStore as any).setState(input);
}

export function mergeState(
  input: Patch<RootState> | Updater<RootState>,
): Promise<void> {
  ensureGlobalWired();
  return (defaultStore as any).mergeState(input);
}
