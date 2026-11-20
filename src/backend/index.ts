import type { Backend } from "./Backend";

export const IS_REMOTE = import.meta.env.VITE_BACKEND === "remote";

/** Picks the backend from the build flag: VITE_BACKEND=remote → shared server, else this browser. */
export async function createBackend(): Promise<Backend> {
  if (IS_REMOTE) {
    const { RemoteBackend } = await import("./RemoteBackend");
    return new RemoteBackend({ base: "/api" });
  }
  const [{ LocalBackend }, { aesCodec, getOrCreateBrowserKey }, { demoDb }] = await Promise.all([
    import("./LocalBackend"),
    import("./secureStore"),
    import("../core/seed"),
  ]);
  const key = await getOrCreateBrowserKey();
  return new LocalBackend({
    storage: localStorage,
    codec: aesCodec(key),
    seed: () => demoDb(Date.now()),
    live: true,
  });
}
