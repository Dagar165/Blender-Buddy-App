import glassesOverlay from "@/assets/mascot/item-glasses.webp";
import hatOverlay from "@/assets/mascot/item-hat.webp";
import headphonesOverlay from "@/assets/mascot/item-headphones.webp";
import {
  Crown,
  Gamepad2,
  Glasses,
  Headphones,
  Keyboard,
  Mouse,
  Palette,
  Rocket,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Правила редактирования (для владельца):
 * - цены (cost) и названия (name) можно менять свободно
 * - id у существующих предметов не менять
 * - новый предмет = новый id (item11, item12, ...)
 * - ВАЖНО: name у уже купленных предметов лучше не менять —
 *   покупки запоминаются по названию
 *
 * ПРО ЦЕНЫ (пересчитано 21.07.2026, не сбрасывать наугад).
 *
 * Голда приходит примерно 620 в неделю чистыми у того, кто делает всё
 * и уже кормит призрака. Дорога до 30 уровня — около десяти недель, то есть
 * за неё набегает ~6000 голды. Весь гардероб стоит 7360 — значит скупить его
 * раньше 30 уровня нельзя, а «легендарные» вещи остаются целью и после.
 *
 * Если меняешь награды за задания — пересчитай и цены, иначе одежда либо
 * скупится за две недели, либо не покупается никогда.
 */

// Припасы (расходники) — цены и лимиты
export const STREAK_FREEZE_COST = 150; // заморозка серии
export const STREAK_FREEZE_MAX = 2; // больше двух про запас не купить
export const DOUBLE_POTION_COST = 100; // зелье ×2
export const DOUBLE_POTION_MAX = 3; // лимит запаса зелий

/**
 * МЕСТА ДЛЯ ОДЕЖДЫ и ПОРЯДОК СЛОЁВ.
 *
 * На одном месте живёт ровно одна вещь: надел одну шляпу — прежняя снялась.
 * Но РАЗНЫЕ места надеваются одновременно, и это главное: на референсе
 * владельца призрак носит шляпу, наушники и очки разом.
 *
 * Порядок слоёв — его решение, проверено на картинке:
 * **шляпа перекрывает всё, наушники под ней, очки в самом низу.**
 * Меньше число — рисуется раньше, то есть ниже. Слой 1 — сам призрак,
 * поэтому у ранца за спиной слой 0: он ЗА призраком.
 */
export type ClothingSlot = "back" | "hand" | "face" | "ears" | "head";

export const GHOST_LAYER = 1;

/**
 * Одежда рисуется на холсте ШИРЕ призрака, снизу вровень с ним.
 *
 * Над макушкой у картинок призрака всего 12% высоты, а шляпе нужно вдвое
 * больше — без запаса её пришлось бы уменьшить до размера чепчика. Число
 * жёстко связано со спрайтами: они нарезаны именно под 1.18, поменяешь
 * здесь — все вещи съедут.
 */
export const CLOTHING_FRAME = 1.18;

export const CLOTHING_SLOTS: {
  id: ClothingSlot;
  // Как место называется ученику — видно на карточке в магазине.
  name: string;
  layer: number;
}[] = [
  { id: "back", name: "За спиной", layer: 0 },
  { id: "hand", name: "В руке", layer: 2 },
  { id: "face", name: "На глазах", layer: 3 },
  { id: "ears", name: "На ушах", layer: 4 },
  { id: "head", name: "На голове", layer: 5 },
];

export const getClothingSlot = (slot: ClothingSlot) =>
  CLOTHING_SLOTS.find((entry) => entry.id === slot) ?? CLOTHING_SLOTS[0];

export type ShopItem = {
  id: string;
  name: string;
  cost: number;
  icon: LucideIcon;
  color: string;
  bg: string;
  // Куда вещь надевается. На одно место — одна вещь.
  slot: ClothingSlot;
  // Картинка-одежда. Рисуется на холсте CLOTHING_FRAME (см. выше), снизу
  // вровень с призраком, поэтому вещь уже стоит на своём месте и никаких
  // отступов в коде не нужно. Как готовить файл — tools/README-mascot.md.
  // Как подключить: import hatOverlay from "@/assets/mascot/item-hat.webp";
  // и сюда overlay: hatOverlay. Пока картинки нет — поле пустое:
  // вещь покупается и надевается, просто пока не видна на призраке.
  overlay?: string;
  // Дорогая вещь «на потом»: помечается в магазине и стоит заметно больше.
  legendary?: boolean;
};

// Предметы для питомца (покупаются один раз), отсортированы по цене.
// legendary — вещи «на потом»: их специально не успеть купить к 30 уровню,
// чтобы после максимума оставалось к чему стремиться.
export const SHOP_ITEMS: ShopItem[] = [
  { id: "item5", name: "Стильные очки", cost: 80, slot: "face", overlay: glassesOverlay, icon: Glasses, color: "text-sky-500", bg: "bg-sky-100" },
  { id: "item1", name: "Волшебная шляпа", cost: 150, slot: "head", overlay: hatOverlay, icon: Crown, color: "text-purple-500", bg: "bg-purple-100" },
  { id: "item6", name: "Наушники", cost: 220, slot: "ears", overlay: headphonesOverlay, icon: Headphones, color: "text-emerald-500", bg: "bg-emerald-100" },
  { id: "item2", name: "Зелье скорости", cost: 300, slot: "hand", icon: Zap, color: "text-blue-500", bg: "bg-blue-100" },
  { id: "item7", name: "Палитра художника", cost: 380, slot: "hand", icon: Palette, color: "text-pink-500", bg: "bg-pink-100" },
  { id: "item3", name: "Золотая клавиатура", cost: 480, slot: "hand", icon: Keyboard, color: "text-yellow-500", bg: "bg-yellow-100" },
  { id: "item4", name: "Про-мышь", cost: 600, slot: "hand", icon: Mouse, color: "text-rose-500", bg: "bg-rose-100" },
  { id: "item8", name: "Геймпад", cost: 750, slot: "hand", icon: Gamepad2, color: "text-indigo-500", bg: "bg-indigo-100" },
  { id: "item9", name: "Волшебная палочка", cost: 1800, slot: "hand", icon: Wand2, color: "text-violet-500", bg: "bg-violet-100", legendary: true },
  { id: "item10", name: "Реактивный ранец", cost: 2600, slot: "back", icon: Rocket, color: "text-orange-500", bg: "bg-orange-100", legendary: true },
];

export const getShopItem = (itemId: string) =>
  SHOP_ITEMS.find((item) => item.id === itemId) ?? null;
