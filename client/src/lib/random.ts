/**
 * «Случайное, но повторяемое».
 *
 * Обычный `Math.random()` при каждом открытии экрана даёт новый ответ —
 * а нам часто нужно обратное: чтобы у одного и того же дня (или круга советов)
 * всегда выпадал ОДИН и тот же перемешанный порядок, сколько бы раз ребёнок
 * ни закрыл и ни открыл приложение. Поэтому случайность берётся не из воздуха,
 * а из числа-семечка: одно семечко — всегда одна и та же последовательность.
 *
 * Пользуются этим двое: задания дня (quests-rotation.ts) и советы призрака
 * (tips-config.ts). Раньше эти функции лежали копией внутри quests-rotation.
 */

// Превращает строку (например ключ дня «daily-2026-07-25») в число-семечко.
export function createSeedFromString(value: string) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash) || 1;
}

// Генератор чисел от 0 до 1. От одного семечка — всегда один и тот же ряд.
export function createRandom(seed: number) {
  let state = seed;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;

    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
