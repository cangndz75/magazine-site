import type { MediaObjectPutInput, MediaObjectStore } from "./types";

export type MemoryMediaObjectStore = MediaObjectStore & {
  objects: Map<string, { body: Buffer; contentType: string }>;
  failNextPut?: Error;
  failNextDelete?: Error;
  failPutOfKey?: string;
};

export function createMemoryMediaObjectStore(): MemoryMediaObjectStore {
  const objects = new Map<string, { body: Buffer; contentType: string }>();
  const store: MemoryMediaObjectStore = {
    objects,
    async put(input: MediaObjectPutInput) {
      if (store.failPutOfKey && input.key === store.failPutOfKey) {
        store.failPutOfKey = undefined;
        throw new Error("put denied for key");
      }
      if (store.failNextPut) {
        const error = store.failNextPut;
        store.failNextPut = undefined;
        throw error;
      }
      objects.set(input.key, { body: input.body, contentType: input.contentType });
    },
    async delete(key: string) {
      if (store.failNextDelete) {
        const error = store.failNextDelete;
        store.failNextDelete = undefined;
        throw error;
      }
      objects.delete(key);
    },
  };
  return store;
}
