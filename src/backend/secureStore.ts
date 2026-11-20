import { b64ToBytes, bytesToB64, randomBytes } from "../core/crypto";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Codec {
  encode(plain: string): Promise<string>;
  decode(stored: string): Promise<string>;
}

export class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  dump() {
    return Object.fromEntries(this.map);
  }
}

export const plainCodec: Codec = {
  encode: async (s) => s,
  decode: async (s) => s,
};

/** AES-GCM codec. Stored format: `aesgcm1:<iv b64>:<ciphertext b64>`. */
export function aesCodec(key: CryptoKey): Codec {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  return {
    async encode(plain) {
      const iv = randomBytes(12);
      const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
      return `aesgcm1:${bytesToB64(iv)}:${bytesToB64(new Uint8Array(ct))}`;
    },
    async decode(stored) {
      const [tag, iv, ct] = stored.split(":");
      if (tag !== "aesgcm1" || !iv || !ct) throw new Error("Unknown storage format");
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(iv) }, key, b64ToBytes(ct));
      return dec.decode(pt);
    },
  };
}

export function generateStorageKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

const IDB_NAME = "doomsday-cypher";
const IDB_STORE = "keys";
const KEY_ID = "storage-key";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** A non-extractable AES-GCM key, persisted (as a CryptoKey object) in IndexedDB. */
export async function getOrCreateBrowserKey(): Promise<CryptoKey> {
  const db = await idb();
  const get = () =>
    new Promise<CryptoKey | undefined>((resolve, reject) => {
      const r = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(KEY_ID);
      r.onsuccess = () => resolve(r.result as CryptoKey | undefined);
      r.onerror = () => reject(r.error);
    });
  const existing = await get();
  if (existing) return existing;
  const key = await generateStorageKey();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(key, KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return (await get()) ?? key;
}
