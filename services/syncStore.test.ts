import { expect, mock, test } from "bun:test";
import type { LibraryEntry } from "@/core/game";
import { deletedEntries, newSyncState } from "@/core/syncClient";

// In-memory AsyncStorage: the real one needs React Native.
const stored = new Map<string, string>();
mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: (key: string) => Promise.resolve(stored.get(key) ?? null),
    setItem: (key: string, value: string) => {
      stored.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      stored.delete(key);
      return Promise.resolve();
    },
  },
}));

const {
  getSyncState,
  notifyLocalChange,
  recordDeletions,
  setSyncState,
  syncStateLoaded,
  watchLocalChanges,
} = await import("./syncStore");

const entry: LibraryEntry = {
  game: { id: 1, name: "Zelda" },
  status: "playing",
  rating: 0,
  platforms: [],
  addedAt: 1000,
  updatedAt: 2000,
};

const saved = () => JSON.parse(stored.get("sync:state") ?? "null");

test("records no deletion while sync is off", async () => {
  await syncStateLoaded;
  recordDeletions(deletedEntries([entry], 3000));
  expect(getSyncState()).toBeNull();
  expect(stored.has("sync:state")).toBe(false);
});

test("records deletions while sync is on, and saves them", async () => {
  await setSyncState(newSyncState());
  recordDeletions(deletedEntries([entry], 3000));
  expect(getSyncState()?.tombstones.entries).toHaveLength(1);
  // Writes go in order: this one waits for the previous ones.
  await setSyncState(getSyncState());
  expect(saved().tombstones.entries[0].deletedAt).toBe(3000);
});

test("turning sync off forgets them", async () => {
  await setSyncState(null);
  expect(stored.has("sync:state")).toBe(false);
});

test("tells the sync about the user's changes only while sync is on", async () => {
  let heard = 0;
  const stop = watchLocalChanges(() => {
    heard += 1;
  });
  notifyLocalChange();
  expect(heard).toBe(0);
  await setSyncState(newSyncState());
  notifyLocalChange();
  expect(heard).toBe(1);
  stop();
  notifyLocalChange();
  expect(heard).toBe(1);
  await setSyncState(null);
});
