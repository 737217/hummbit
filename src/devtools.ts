type DevtoolsMessage =
  | {
      type: "DISPATCH";
      payload?: { type?: string };
      state?: string;
    }
  | {
      type: "ACTION";
      payload?: string;
      state?: string;
    };

type DevtoolsConnection = {
  init(state: any): void;
  send(action: any, state: any): void;
  subscribe(listener: (message: DevtoolsMessage) => void): () => void;
  unsubscribe(): void;
};

type DevtoolsExtension = {
  connect(options?: any): DevtoolsConnection;
};

export type DevtoolsConfig = boolean | { enabled?: boolean; name?: string };

export function isProductionEnv(): boolean {
  const g: any = typeof globalThis !== "undefined" ? (globalThis as any) : {};
  const nodeEnv = g?.process?.env?.NODE_ENV;
  return nodeEnv === "production";
}

function getExtension(): DevtoolsExtension | null {
  const g: any = typeof globalThis !== "undefined" ? (globalThis as any) : null;
  const w: any = typeof window !== "undefined" ? (window as any) : null;
  const ext = (w?.__REDUX_DEVTOOLS_EXTENSION__ ??
    g?.__REDUX_DEVTOOLS_EXTENSION__) as DevtoolsExtension | undefined;
  return ext ?? null;
}

export type DevtoolsAdapter<S extends object> = {
  init(state: Readonly<S>): void;
  send(
    action: { type: string; payload?: any } | string,
    state: Readonly<S>,
  ): void;
  subscribe(listener: (message: DevtoolsMessage) => void): () => void;
  disconnect(): void;
};

export function createDevtoolsAdapter<S extends object>(options: {
  name: string;
}): DevtoolsAdapter<S> | null {
  const ext = getExtension();
  if (!ext) return null;

  const conn = ext.connect({ name: options.name });

  return {
    init(state) {
      conn.init(state as any);
    },
    send(action, state) {
      conn.send(action as any, state as any);
    },
    subscribe(listener) {
      return conn.subscribe(listener);
    },
    disconnect() {
      conn.unsubscribe();
    },
  };
}

export function resolveDevtoolsOptions(input: DevtoolsConfig | undefined): {
  enabled: boolean;
  name?: string;
} {
  if (input === true) return { enabled: true };
  if (input === false) return { enabled: false };
  if (typeof input === "object" && input) {
    return { enabled: input.enabled ?? true, name: input.name };
  }

  // auto: enabled in non-production
  return { enabled: !isProductionEnv() };
}
