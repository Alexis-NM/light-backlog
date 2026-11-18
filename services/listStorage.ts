import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GameList } from "@/core/game";
import {
  type GameListV1,
  sortLists,
  upgradeList,
  upgradeLists,
} from "@/core/lists";

// Each list lives under its own key so a change only rewrites that list and a
// single big list never hits Android's per-row storage limit.
const LEGACY_KEY = "lists";
const ORDER_KEY = "lists:order";
const listKey = (id: string) => `list:${id}`;

function parse<T>(raw: string | null): T | undefined {
  if (raw === null) {
    return;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return;
  }
}

const isUpgraded = (list: GameList | GameListV1): list is GameList =>
  "items" in list;

function saveLists(lists: GameList[]) {
  return AsyncStorage.multiSet(
    lists.map((list) => [listKey(list.id), JSON.stringify(list)])
  );
}

/** Loads the lists in display order, converting those stored by version 1.4 and older. */
export async function loadLists(): Promise<GameList[]> {
  const legacy = parse<GameListV1[]>(await AsyncStorage.getItem(LEGACY_KEY));
  if (legacy) {
    const lists = upgradeLists(legacy);
    await saveAllLists(lists);
    await AsyncStorage.removeItem(LEGACY_KEY);
    return lists;
  }
  const order = parse<string[]>(await AsyncStorage.getItem(ORDER_KEY)) ?? [];
  if (order.length === 0) {
    return [];
  }
  const rows = await AsyncStorage.multiGet(order.map(listKey));
  const lists: GameList[] = [];
  const upgraded: GameList[] = [];
  for (const [index, [, raw]] of rows.entries()) {
    const stored = parse<GameList | GameListV1>(raw);
    if (!stored) {
      continue;
    }
    if (isUpgraded(stored)) {
      lists.push(stored);
    } else {
      const list = upgradeList(stored, index);
      lists.push(list);
      upgraded.push(list);
    }
  }
  if (upgraded.length > 0) {
    // If this write fails, the next launch converts the same lists the same way.
    await saveLists(upgraded).catch(() => undefined);
  }
  return sortLists(lists);
}

export function saveList(list: GameList) {
  return AsyncStorage.setItem(listKey(list.id), JSON.stringify(list));
}

/** Keeps the index of stored lists, in display order. */
export function saveListOrder(lists: GameList[]) {
  return AsyncStorage.setItem(
    ORDER_KEY,
    JSON.stringify(lists.map((list) => list.id))
  );
}

export async function saveAllLists(lists: GameList[]) {
  await saveLists(lists);
  await saveListOrder(lists);
}

export function removeList(id: string) {
  return AsyncStorage.removeItem(listKey(id));
}

export function removeAllLists(lists: GameList[]) {
  return AsyncStorage.multiRemove([
    ORDER_KEY,
    ...lists.map((list) => listKey(list.id)),
  ]);
}
