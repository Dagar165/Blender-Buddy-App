import {
  CLOTHING_FRAME,
  SHOP_ITEMS,
  getClothingSlot,
  getShopItem,
  type ClothingSlot,
  type ShopItem,
} from "@/lib/shop-config";
import type { PetStage } from "@/lib/pet-config";

/**
 * ГАРДЕРОБ: что из купленного сейчас надето на призраке.
 *
 * Купленное лежит в inventory (по названиям, так считаются медали), а здесь —
 * только «что надето»: место → id вещи. Разведено нарочно: раньше покупка
 * означала «надето навсегда», снять было нельзя, и наушники с шапкой лезли
 * друг на друга. Теперь на место садится одна вещь, остальное ждёт в шкафу.
 *
 * Хранятся ID, а не названия: название владелец может переписать в любой
 * момент (в shop-config так и написано), и надетая вещь не должна от этого
 * слетать.
 */
export type Equipped = Partial<Record<ClothingSlot, string>>;

/**
 * Поправка размера вещей ГОЛОВЫ по стадиям.
 *
 * Мерки сняты линейкой по готовым картинкам (таблица — в документе
 * «JKids_Bot_промпты_картинок.md»): макушки всех стадий стоят на одной высоте,
 * рост и центр совпадают, но голова на 5-м уровне ШИРЕ остальных примерно
 * на 8%. Одежда рисуется на призраке 5-го уровня, поэтому на старших стадиях
 * её нужно чуть ужать — иначе шапка будет висеть по бокам головы.
 *
 * Ключ — fromLevel стадии. Тела и рук это не касается: они совпадают.
 * У 1-й стадии (малыш из первой генерации) мерок нет — оставлен 1,
 * поправить, когда под неё будет что мерить.
 */
export const HEAD_SCALE_BY_STAGE: Record<number, number> = {
  1: 1,
  5: 1,
  12: 0.93,
  20: 0.92,
  30: 0.92,
};

// Всё, что сидит на голове, ужимается вместе: шляпа, наушники и очки должны
// съезжать одинаково, иначе на старших стадиях очки разъедутся со шляпой.
const HEAD_SLOTS: ClothingSlot[] = ["head", "ears", "face"];

/**
 * Точка, вокруг которой ужимается вещь головы.
 *
 * Не центр картинки, а середина головы — она на 26% высоты КАРТИНКИ ПРИЗРАКА.
 * Ужми относительно центра — и шапка уедет со лба на глаза.
 *
 * Холст одежды выше призрака (CLOTHING_FRAME) и выровнен по низу, поэтому
 * те же 26% в его координатах лежат ниже — пересчитываем, а не вписываем
 * число руками: поменяется рамка, поедет и точка.
 */
const HEAD_Y_ON_GHOST = 0.26;
const HEAD_ORIGIN = `50% ${(
  ((CLOTHING_FRAME - 1 + HEAD_Y_ON_GHOST) / CLOTHING_FRAME) *
  100
).toFixed(1)}%`;

export type WornOverlay = {
  itemId: string;
  src: string;
  layer: number;
  scale: number;
  transformOrigin: string;
};

// Надеть: вещь садится на своё место и вытесняет ту, что там была.
export const equipInSlot = (equipped: Equipped, item: ShopItem): Equipped => ({
  ...equipped,
  [item.slot]: item.id,
});

export const clearSlot = (equipped: Equipped, slot: ClothingSlot): Equipped => {
  const next = { ...equipped };
  delete next[slot];
  return next;
};

export const isItemWorn = (equipped: Equipped, item: ShopItem) =>
  equipped[item.slot] === item.id;

// Что надето прямо сейчас — списком вещей, без пустых мест.
export const getWornItems = (equipped: Equipped): ShopItem[] =>
  SHOP_ITEMS.filter((item) => isItemWorn(equipped, item));

/**
 * Чистка гардероба: выкидывает вещи, которых больше нет в магазине или
 * которые не куплены.
 *
 * Нужна при слиянии с облаком и после правок shop-config: иначе на призраке
 * останется висеть id несуществующей вещи, а место будет считаться занятым.
 */
export const sanitizeEquipped = (
  equipped: Equipped | undefined,
  inventory: string[]
): Equipped => {
  const clean: Equipped = {};

  for (const [slot, itemId] of Object.entries(equipped ?? {})) {
    if (!itemId) continue;

    const item = getShopItem(itemId);
    if (!item) continue;
    if (item.slot !== slot) continue;
    if (!inventory.includes(item.name)) continue;

    clean[item.slot] = item.id;
  }

  return clean;
};

/**
 * Разовый перенос старых покупок: до этой версии «куплено» означало «надето
 * навсегда», и поля `equipped` в памяти просто нет.
 *
 * Чтобы призрак не разделся сам после обновления, на каждое место садится
 * самая дорогая купленная вещь — ту, что ученик добывал дольше всех, он и
 * хочет видеть. Дальше он переоденется в магазине как захочет.
 */
export const seedEquippedFromInventory = (inventory: string[]): Equipped => {
  const seeded: Equipped = {};

  for (const item of SHOP_ITEMS) {
    if (!inventory.includes(item.name)) continue;

    const current = seeded[item.slot];
    const currentCost = current ? getShopItem(current)?.cost ?? 0 : -1;

    if (item.cost > currentCost) {
      seeded[item.slot] = item.id;
    }
  }

  return seeded;
};

/**
 * Картинки надетых вещей для комнаты призрака — уже в порядке рисования.
 *
 * Вещи без картинки сюда не попадают: их ещё не нарисовали, но купить
 * и надеть их уже можно — на призраке они просто не видны.
 */
export const getWornOverlays = (
  equipped: Equipped,
  stage: PetStage
): WornOverlay[] =>
  getWornItems(equipped)
    .filter((item): item is ShopItem & { overlay: string } => Boolean(item.overlay))
    .map((item) => {
      const onHead = HEAD_SLOTS.includes(item.slot);

      return {
        itemId: item.id,
        src: item.overlay,
        layer: getClothingSlot(item.slot).layer,
        scale: onHead ? HEAD_SCALE_BY_STAGE[stage.fromLevel] ?? 1 : 1,
        transformOrigin: onHead ? HEAD_ORIGIN : "50% 50%",
      };
    })
    .sort((a, b) => a.layer - b.layer);
