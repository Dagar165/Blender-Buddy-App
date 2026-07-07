import type { PetAccessory, PetMood } from "@/lib/pet-config";

/**
 * ПИКСЕЛЬНЫЙ ПРИЗРАК И ОДЕЖДА — всё рисуется кодом, картинок нет.
 *
 * Как это устроено:
 * - есть общая сетка SPRITE_W × SPRITE_H (18×19 «пикселей»);
 * - призрак (GHOST_BODY) и любая одежда (ACCESSORIES) заданы на ОДНОЙ сетке,
 *   поэтому одежда автоматически «садится» на призрака и масштабируется вместе с ним;
 * - каждый спрайт = набор строк + палитра (буква -> цвет). Точка "." = прозрачно.
 *
 * КАК ДОБАВИТЬ НОВУЮ ВЕЩЬ ИЗ МАГАЗИНА (пример — шляпа):
 *   1) придумай буквы-цвета, например s = верх шляпы, e = поля;
 *   2) нарисуй строками поверх нужной зоны (шапки рисуют по строкам 0–2, очки 7–9,
 *      пояс/низ 14–16). Каждая строка ДОЛЖНА быть ровно 18 символов;
 *   3) добавь запись в ACCESSORIES или в отдельный список одежды и укажи палитру.
 * Больше ничего менять не нужно — призрак наденет её сам.
 */

export const SPRITE_W = 18;
export const SPRITE_H = 19;

export type Sprite = {
  rows: string[];
  palette: Record<string, string>;
};

const EMPTY = ".".repeat(SPRITE_W);

// Собирает полную сетку (19 строк) из «редких» строк: {номер строки: рисунок}
const grid = (map: Record<number, string>): string[] =>
  Array.from({ length: SPRITE_H }, (_, i) => map[i] ?? EMPTY);

// Тело призрака. Буквы: O — контур, B — тело, W — белок глаза,
// K — зрачок, P — румянец. Цвета O и B подставляются под стадию (см. ghost.tsx).
export const GHOST_BODY: string[] = [
  "......OOOOOO......",
  "....OOBBBBBBOO....",
  "...OBBBBBBBBBBO...",
  "..OBBBBBBBBBBBBO..",
  "..OBBBBBBBBBBBBO..",
  ".OBBBBBBBBBBBBBBO.",
  ".OBBBBBBBBBBBBBBO.",
  ".OBWWWBBBBBBWWWBO.",
  ".OBWKWBBBBBBWKWBO.",
  ".OBWWWBBBBBBWWWBO.",
  ".OBBBBBBBBBBBBBBO.",
  ".OBPPBBBBBBBBPPBO.",
  ".OBBBBBBBBBBBBBBO.",
  ".OBBBBBBBBBBBBBBO.",
  "..OBBBBBBBBBBBBO..",
  "..OBBBBBBBBBBBBO..",
  "..OBBBBBBBBBBBBO..",
  "..OBBBBO..OBBBBO..",
  "...OOOO....OOOO...",
];

// Рот и брови по настроению. K — тёмно-синий контур лица.
export const FACE_PALETTE: Record<string, string> = { K: "#22304a" };

export const FACES: Record<PetMood, string[]> = {
  idle: grid({ 12: ".......KKKK......." }),
  happy: grid({
    11: "......K....K......",
    12: ".......KKKK.......",
  }),
  // Зелье — та же довольная мордочка + искры (добавляются отдельно)
  potion: grid({
    11: "......K....K......",
    12: ".......KKKK.......",
  }),
  worried: grid({
    6: "...KK......KK.....",
    11: ".......KKKK.......",
    12: "......K....K......",
  }),
};

// Искры, когда выпито зелье ×2
export const SPARKLES: Sprite = {
  rows: grid({
    1: "..Y............Y..",
    5: "...............Y..",
    9: "Y................Y",
  }),
  palette: { Y: "#FDE68A" },
};

// Одежда/аксессуары стадий. Это же формат для будущих вещей из магазина.
export const ACCESSORIES: Record<PetAccessory, Sprite> = {
  // Малыш: подгузник (D) с булавкой (y)
  diaper: {
    rows: grid({
      14: "...DDDDDDDDDDDD...",
      15: "...DDDDDyDDDDDD...",
      16: "...DDDDDDDDDDDD...",
    }),
    palette: { D: "#EEF2F7", y: "#FBBF24" },
  },
  // Оранжевая шапочка
  beanie: {
    rows: grid({
      0: "......gggggg......",
      1: "....gghhhhhhgg....",
      2: "...ghhhhhhhhhhg...",
    }),
    palette: { g: "#EA580C", h: "#F97316" },
  },
  // Очки
  glasses: {
    rows: grid({
      7: "..fffff....fffff..",
      8: "..flllf.ff.flllf..",
      9: "..fffff....fffff..",
    }),
    palette: { f: "#7C3AED", l: "#DDD6FE" },
  },
  // Академическая шапка с кисточкой
  gradcap: {
    rows: grid({
      0: "..nnnnnnnnnnnnnn..",
      1: ".......dddd.t.....",
      2: "............t.....",
      3: "...........tt.....",
    }),
    palette: { n: "#1E3A8A", d: "#172554", t: "#FACC15" },
  },
  // Золотая корона с камнем
  crown: {
    rows: grid({
      0: "....t...t...t.....",
      1: "...ttttttttttt....",
      2: "...tttttjttttt....",
    }),
    palette: { t: "#FACC15", j: "#FB7185" },
  },
};
