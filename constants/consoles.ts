import type { Console } from "@/types/game";

// IGDB platform IDs (https://api.igdb.com/v4/platforms).
// `family` is a translation key (see family_* in i18n/translations.ts).
// Within each family, consoles are ordered newest release first.
export const CONSOLES: readonly Console[] = [
  { id: 167, name: "PlayStation 5", family: "playstation" }, // 2020
  { id: 48, name: "PlayStation 4", family: "playstation" }, // 2013
  { id: 46, name: "PS Vita", family: "playstation" }, // 2011
  { id: 9, name: "PlayStation 3", family: "playstation" }, // 2006
  { id: 38, name: "PSP", family: "playstation" }, // 2004
  { id: 8, name: "PlayStation 2", family: "playstation" }, // 2000
  { id: 7, name: "PlayStation", family: "playstation" }, // 1994

  { id: 169, name: "Xbox Series X|S", family: "xbox" }, // 2020
  { id: 49, name: "Xbox One", family: "xbox" }, // 2013
  { id: 12, name: "Xbox 360", family: "xbox" }, // 2005
  { id: 11, name: "Xbox", family: "xbox" }, // 2001

  { id: 508, name: "Nintendo Switch 2", family: "nintendo" }, // 2025
  { id: 130, name: "Nintendo Switch", family: "nintendo" }, // 2017
  { id: 41, name: "Wii U", family: "nintendo" }, // 2012
  { id: 37, name: "Nintendo 3DS", family: "nintendo" }, // 2011
  { id: 5, name: "Wii", family: "nintendo" }, // 2006
  { id: 20, name: "Nintendo DS", family: "nintendo" }, // 2004
  { id: 21, name: "GameCube", family: "nintendo" }, // 2001
  { id: 24, name: "Game Boy Advance", family: "nintendo" }, // 2001
  { id: 22, name: "Game Boy Color", family: "nintendo" }, // 1998
  { id: 4, name: "Nintendo 64", family: "nintendo" }, // 1996
  { id: 87, name: "Virtual Boy", family: "nintendo" }, // 1995
  { id: 19, name: "SNES", family: "nintendo" }, // 1990
  { id: 33, name: "Game Boy", family: "nintendo" }, // 1989
  { id: 18, name: "NES", family: "nintendo" }, // 1983

  { id: 23, name: "Dreamcast", family: "sega" }, // 1998
  { id: 32, name: "Saturn", family: "sega" }, // 1994
  { id: 30, name: "Sega 32X", family: "sega" }, // 1994
  { id: 78, name: "Sega CD", family: "sega" }, // 1991
  { id: 35, name: "Game Gear", family: "sega" }, // 1990
  { id: 29, name: "Mega Drive / Genesis", family: "sega" }, // 1988
  { id: 64, name: "Master System", family: "sega" }, // 1985

  { id: 6, name: "PC (Windows)", family: "pc" },
  { id: 14, name: "Mac", family: "pc" },

  { id: 34, name: "Android", family: "mobile" }, // 2008
  { id: 39, name: "iOS", family: "mobile" }, // 2007

  { id: 57, name: "WonderSwan", family: "retro" }, // 1999
  { id: 50, name: "3DO", family: "retro" }, // 1993
  { id: 80, name: "Neo Geo", family: "retro" }, // 1990
  { id: 61, name: "Atari Lynx", family: "retro" }, // 1989
  { id: 86, name: "TurboGrafx-16 / PC Engine", family: "retro" }, // 1987
  { id: 16, name: "Amiga", family: "retro" }, // 1985
  { id: 15, name: "Commodore 64", family: "retro" }, // 1982
  { id: 59, name: "Atari 2600", family: "retro" }, // 1977
  { id: 52, name: "Arcade", family: "retro" },

  { id: 381, name: "Playdate", family: "other" }, // 2022
];

export const CONSOLE_FAMILIES: readonly string[] = [
  "playstation",
  "xbox",
  "nintendo",
  "sega",
  "pc",
  "mobile",
  "retro",
  "other",
];

// Consoles absent from IGDB's platform list, offered as manual tags in the
// game detail (e.g. Steam Deck — its games are filed under PC/Linux on IGDB).
export const EXTRA_CONSOLES: readonly string[] = ["Steam Deck"];

// Short names people write after a title, e.g. "Halo (Xbox)" or "Doom [PC]".
// Keys are lower-case with everything but letters and digits removed.
const CONSOLE_ALIASES: Record<string, number> = {
  ps1: 7,
  psx: 7,
  psone: 7,
  playstation1: 7,
  ps2: 8,
  ps3: 9,
  ps4: 48,
  ps5: 167,
  psp: 38,
  vita: 46,
  psvita: 46,
  playstationvita: 46,
  xbox360: 12,
  x360: 12,
  xboxone: 49,
  xb1: 49,
  xone: 49,
  xboxseries: 169,
  xboxseriesx: 169,
  xboxseriess: 169,
  xsx: 169,
  switch: 130,
  nsw: 130,
  nintendoswitch: 130,
  switch2: 508,
  wiiu: 41,
  nintendowiiu: 41,
  wii: 5,
  nintendowii: 5,
  gc: 21,
  ngc: 21,
  nintendogamecube: 21,
  n64: 4,
  snes: 19,
  supernintendo: 19,
  superfamicom: 19,
  nes: 18,
  famicom: 18,
  gb: 33,
  gameboy: 33,
  gbc: 22,
  gba: 24,
  ds: 20,
  nds: 20,
  nintendods: 20,
  "3ds": 37,
  genesis: 29,
  megadrive: 29,
  segagenesis: 29,
  segamegadrive: 29,
  dreamcast: 23,
  segadreamcast: 23,
  saturn: 32,
  segasaturn: 32,
  mastersystem: 64,
  gamegear: 35,
  pc: 6,
  windows: 6,
  steam: 6,
  steamdeck: 6,
  mac: 14,
  macos: 14,
  android: 34,
  ios: 39,
  iphone: 39,
  ipad: 39,
  arcade: 52,
  neogeo: 80,
  pcengine: 86,
  turbografx: 86,
  turbografx16: 86,
  amiga: 16,
  c64: 15,
  commodore64: 15,
  atari2600: 59,
  lynx: 61,
  playdate: 381,
};

const compactName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "");

const CONSOLE_LOOKUP: Record<string, number> = {
  ...CONSOLE_ALIASES,
  ...Object.fromEntries(CONSOLES.map((c) => [compactName(c.name), c.id])),
};

/** IGDB platform id for a console name or alias ("PlayStation 2", "PS2"…). */
export function platformIdFor(name: string): number | undefined {
  return CONSOLE_LOOKUP[compactName(name)];
}

/** IGDB platform ids for the consoles picked in the app (unknown names dropped). */
export function platformIdsFor(names: readonly string[]): number[] {
  const ids = names
    .map(platformIdFor)
    .filter((id): id is number => id !== undefined);
  return Array.from(new Set(ids));
}
