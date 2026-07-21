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
 * Поправка вещей ГОЛОВЫ по стадиям: размер И сдвиг.
 *
 * Одного множителя размера не хватило — владелец увидел это первым: на малыше
 * вещи сидели совсем криво. Причина в том, что у стадий разная не только
 * ширина головы, но и её ВЫСОТА в кадре: у малыша голова ниже и меньше,
 * глаза на 37% высоты холста вместо 27%.
 *
 * Мерки сняты линейкой по тем самым картинкам, что стоят в приложении
 * (не по исходникам из папок — они бывают другой версии):
 *
 *   стадия      ширина головы   центр глаз (x, y)
 *   1 малыш        36%           53,5 / 37
 *   5 (базовая)    42%           55,5 / 27,5
 *   12             39,3%         55   / 27
 *   20             38,8%         54,5 / 27
 *   30             38,7%         54,5 / 27
 *
 * Отсюда: масштаб = ширина головы стадии / 42, сдвиг = разница центров глаз
 * после масштабирования. Всё в процентах квадрата призрака.
 *
 * Ключ — fromLevel стадии. Тела и рук это не касается.
 */
export type HeadFit = { scale: number; dx: number; dy: number };

export const HEAD_FIT_BY_STAGE: Record<number, HeadFit> = {
  1: { scale: 0.86, dx: -1.2, dy: 10.1 },
  5: { scale: 1, dx: 0, dy: 0 },
  12: { scale: 0.93, dx: 0, dy: 0 },
  20: { scale: 0.92, dx: 0, dy: 0 },
  30: { scale: 0.92, dx: 0, dy: 0 },
};

const NO_FIT: HeadFit = { scale: 1, dx: 0, dy: 0 };

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
  // Сдвиг в процентах САМОЙ КАРТИНКИ одежды — CSS-проценты в translate
  // считаются от размера элемента, а он в CLOTHING_FRAME раз больше призрака.
  dxPercent: number;
  dyPercent: number;
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
      const fit = onHead ? HEAD_FIT_BY_STAGE[stage.fromLevel] ?? NO_FIT : NO_FIT;

      return {
        itemId: item.id,
        src: item.overlay,
        layer: getClothingSlot(item.slot).layer,
        scale: fit.scale,
        dxPercent: fit.dx / CLOTHING_FRAME,
        dyPercent: fit.dy / CLOTHING_FRAME,
        transformOrigin: onHead ? HEAD_ORIGIN : "50% 50%",
      };
    })
    .sort((a, b) => a.layer - b.layer);
