import type { Console } from "@/types/game";

// IGDB platform IDs (https://api.igdb.com/v4/platforms).
// `family` is a translation key (see family_* in i18n/translations.ts).
export const CONSOLES: readonly Console[] = [
  { id: 167, name: "PlayStation 5", family: "playstation" },
  { id: 48, name: "PlayStation 4", family: "playstation" },
  { id: 9, name: "PlayStation 3", family: "playstation" },
  { id: 8, name: "PlayStation 2", family: "playstation" },
  { id: 7, name: "PlayStation", family: "playstation" },
  { id: 46, name: "PS Vita", family: "playstation" },
  { id: 38, name: "PSP", family: "playstation" },

  { id: 169, name: "Xbox Series X|S", family: "xbox" },
  { id: 49, name: "Xbox One", family: "xbox" },
  { id: 12, name: "Xbox 360", family: "xbox" },
  { id: 11, name: "Xbox", family: "xbox" },

  { id: 508, name: "Nintendo Switch 2", family: "nintendo" },
  { id: 130, name: "Nintendo Switch", family: "nintendo" },
  { id: 41, name: "Wii U", family: "nintendo" },
  { id: 5, name: "Wii", family: "nintendo" },
  { id: 21, name: "GameCube", family: "nintendo" },
  { id: 4, name: "Nintendo 64", family: "nintendo" },
  { id: 19, name: "SNES", family: "nintendo" },
  { id: 18, name: "NES", family: "nintendo" },
  { id: 37, name: "Nintendo 3DS", family: "nintendo" },
  { id: 20, name: "Nintendo DS", family: "nintendo" },
  { id: 24, name: "Game Boy Advance", family: "nintendo" },
  { id: 22, name: "Game Boy Color", family: "nintendo" },
  { id: 33, name: "Game Boy", family: "nintendo" },
  { id: 87, name: "Virtual Boy", family: "nintendo" },

  { id: 29, name: "Mega Drive / Genesis", family: "sega" },
  { id: 32, name: "Saturn", family: "sega" },
  { id: 23, name: "Dreamcast", family: "sega" },
  { id: 64, name: "Master System", family: "sega" },
  { id: 35, name: "Game Gear", family: "sega" },
  { id: 78, name: "Sega CD", family: "sega" },
  { id: 30, name: "Sega 32X", family: "sega" },

  { id: 6, name: "PC (Windows)", family: "pc" },
  { id: 14, name: "Mac", family: "pc" },

  { id: 52, name: "Arcade", family: "retro" },
  { id: 59, name: "Atari 2600", family: "retro" },
  { id: 61, name: "Atari Lynx", family: "retro" },
  { id: 80, name: "Neo Geo", family: "retro" },
  { id: 86, name: "TurboGrafx-16 / PC Engine", family: "retro" },
  { id: 50, name: "3DO", family: "retro" },
  { id: 15, name: "Commodore 64", family: "retro" },
  { id: 16, name: "Amiga", family: "retro" },
  { id: 57, name: "WonderSwan", family: "retro" },

  { id: 381, name: "Playdate", family: "other" },
];

export const CONSOLE_FAMILIES: readonly string[] = [
  "playstation",
  "xbox",
  "nintendo",
  "sega",
  "pc",
  "retro",
  "other",
];
