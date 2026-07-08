import ghostLevel1 from "@/assets/mascot/ghost-level-1.png";

/**
 * Правила редактирования (для владельца):
 * - призрак — КАРТИНКИ на прозрачном фоне (как рисовать — см. документ
 *   «JKids_Bot_спецификация_картинок.md» в папке с документами)
 * - когда картинки готовы: положи файлы в client/src/assets/mascot
 *   (ghost-stage-1.png … ghost-stage-5.png), добавь import сверху как у
 *   ghostLevel1 и поставь его в поле image нужной стадии
 * - пока новых картинок нет, везде стоит старая картинка-заглушка
 * - имена стадий (name), свечение (aura), размер (scale) и фразы (PET_PHRASES)
 *   можно менять свободно; fromLevel — с какого уровня начинается стадия
 * - scale: 1 = максимальный размер, который помещается на экране (уровень 10);
 *   младшие стадии меньше
 */

export type PetStage = {
  fromLevel: number;
  name: string;
  image: string;
  // Цвет свечения вокруг призрака (CSS filter)
  aura: string;
  // Призрак растёт с эволюцией; 1 — потолок
  scale: number;
};

export const PET_STAGES: PetStage[] = [
  {
    // Ждёт арта: малыш в подгузнике, нарочито маленький и милый
    fromLevel: 1,
    name: "Малыш-призрачок",
    image: ghostLevel1,
    aura: "drop-shadow(0 10px 20px rgba(59, 130, 246, 0.18))",
    scale: 0.7,
  },
  {
    fromLevel: 3,
    name: "Призрак-практикант",
    image: ghostLevel1,
    aura: "drop-shadow(0 12px 26px rgba(59, 130, 246, 0.35))",
    scale: 0.8,
  },
  {
    fromLevel: 5,
    name: "Призрак-умелец",
    image: ghostLevel1,
    aura: "drop-shadow(0 14px 30px rgba(139, 92, 246, 0.4))",
    scale: 0.88,
  },
  {
    fromLevel: 7,
    name: "Призрак-мастер",
    image: ghostLevel1,
    aura: "drop-shadow(0 14px 34px rgba(249, 115, 22, 0.4))",
    scale: 0.95,
  },
  {
    fromLevel: 10,
    name: "Легенда 3D",
    image: ghostLevel1,
    aura: "drop-shadow(0 16px 38px rgba(250, 204, 21, 0.5))",
    scale: 1,
  },
];

export const getPetStage = (level: number): PetStage => {
  let stage = PET_STAGES[0];

  for (const candidate of PET_STAGES) {
    if (level >= candidate.fromLevel) stage = candidate;
  }

  return stage;
};

export const getNextPetStage = (level: number): PetStage | null => {
  return PET_STAGES.find((stage) => stage.fromLevel > level) ?? null;
};

// Настроение призрака: от чего оно зависит — см. getPetMood в pet.tsx
export type PetMood = "happy" | "worried" | "potion" | "idle";

export const PET_PHRASES: Record<PetMood, string[]> = {
  happy: [
    "Ура! Сегодня день засчитан 🔥",
    "Ты крут! Я расту вместе с тобой!",
    "Отличная работа! Blender тебе покоряется!",
  ],
  worried: [
    "Ой-ой, серия может сгореть! Сделай задание 🥺",
    "Мне тревожно… одно задание — и серия спасена!",
  ],
  potion: [
    "Зелье бурлит! Следующее задание принесёт ×2 🧪",
    "Чувствую силу зелья! Скорее сделай задание ×2 🧪",
  ],
  idle: [
    "Готов изучать Blender?",
    "Сделаем сегодня что-нибудь крутое?",
    "Я скучал! Погладь меня или загляни в задания!",
  ],
};
