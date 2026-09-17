import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GameList } from "@/types/game";

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

export async function loadLists(): Promise<GameList[]> {
  const legacy = parse<GameList[]>(await AsyncStorage.getItem(LEGACY_KEY));
  if (legacy) {
    await saveAllLists(legacy);
    await AsyncStorage.removeItem(LEGACY_KEY);
    return legacy;
  }
  const order = parse<string[]>(await AsyncStorage.getItem(ORDER_KEY)) ?? [];
  if (order.length === 0) {
    return [];
  }
  const rows = await AsyncStorage.multiGet(order.map(listKey));
  return rows
    .map(([, raw]) => parse<GameList>(raw))
    .filter((list): list is GameList => list !== undefined);
}

export function saveList(list: GameList) {
  return AsyncStorage.setItem(listKey(list.id), JSON.stringify(list));
}

export function saveListOrder(lists: GameList[]) {
  return AsyncStorage.setItem(
    ORDER_KEY,
    JSON.stringify(lists.map((list) => list.id))
  );
}

export async function saveAllLists(lists: GameList[]) {
  await AsyncStorage.multiSet(
    lists.map((list) => [listKey(list.id), JSON.stringify(list)])
  );
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
