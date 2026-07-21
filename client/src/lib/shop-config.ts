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

export type ShopItem = {
  id: string;
  name: string;
  cost: number;
  icon: LucideIcon;
  color: string;
  bg: string;
  // Картинка-одежда, надеваемая на призрака (рисуется на том же шаблоне-холсте,
  // что и сам призрак — см. «JKids_Bot_спецификация_картинок.md»).
  // Как подключить: import hatOverlay from "@/assets/mascot/item-hat.png";
  // и сюда overlay: hatOverlay. Пока картинок нет — поле пустое.
  overlay?: string;
  // Дорогая вещь «на потом»: помечается в магазине и стоит заметно больше.
  legendary?: boolean;
};

// Предметы для питомца (покупаются один раз), отсортированы по цене.
// legendary — вещи «на потом»: их специально не успеть купить к 30 уровню,
// чтобы после максимума оставалось к чему стремиться.
export const SHOP_ITEMS: ShopItem[] = [
  { id: "item5", name: "Стильные очки", cost: 80, icon: Glasses, color: "text-sky-500", bg: "bg-sky-100" },
  { id: "item1", name: "Волшебная шляпа", cost: 150, icon: Crown, color: "text-purple-500", bg: "bg-purple-100" },
  { id: "item6", name: "Наушники", cost: 220, icon: Headphones, color: "text-emerald-500", bg: "bg-emerald-100" },
  { id: "item2", name: "Зелье скорости", cost: 300, icon: Zap, color: "text-blue-500", bg: "bg-blue-100" },
  { id: "item7", name: "Палитра художника", cost: 380, icon: Palette, color: "text-pink-500", bg: "bg-pink-100" },
  { id: "item3", name: "Золотая клавиатура", cost: 480, icon: Keyboard, color: "text-yellow-500", bg: "bg-yellow-100" },
  { id: "item4", name: "Про-мышь", cost: 600, icon: Mouse, color: "text-rose-500", bg: "bg-rose-100" },
  { id: "item8", name: "Геймпад", cost: 750, icon: Gamepad2, color: "text-indigo-500", bg: "bg-indigo-100" },
  { id: "item9", name: "Волшебная палочка", cost: 1800, icon: Wand2, color: "text-violet-500", bg: "bg-violet-100", legendary: true },
  { id: "item10", name: "Реактивный ранец", cost: 2600, icon: Rocket, color: "text-orange-500", bg: "bg-orange-100", legendary: true },
];
