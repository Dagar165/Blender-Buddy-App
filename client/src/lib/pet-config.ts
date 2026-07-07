/**
 * Правила редактирования (для владельца):
 * - призрак теперь РИСУЕТСЯ КОДОМ (client/src/components/ghost.tsx) —
 *   картинки не нужны, всё грузится мгновенно
 * - имена стадий (name), цвета тела (bodyLight/bodyDark), свечение (aura),
 *   размер (scale) и фразы (PET_PHRASES) можно менять свободно
 * - accessory — что надето на призраке на этой стадии:
 *     "diaper"  — подгузник и кудряшка (малыш)
 *     "beanie"  — оранжевая шапочка
 *     "glasses" — очки
 *     "gradcap" — академическая шапка (как на старой картинке)
 *     "crown"   — золотая корона
 * - fromLevel — с какого уровня начинается стадия; не ставь два одинаковых
 */

export type PetAccessory = "diaper" | "beanie" | "glasses" | "gradcap" | "crown";

export type PetStage = {
  fromLevel: number;
  name: string;
  accessory: PetAccessory;
  bodyLight: string;
  bodyDark: string;
  // Цвет свечения вокруг призрака (CSS filter)
  aura: string;
  // Призрак растёт с эволюцией
  scale: number;
};

export const PET_STAGES: PetStage[] = [
  {
    fromLevel: 1,
    name: "Малыш-призрачок",
    accessory: "diaper",
    bodyLight: "#DBEAFE",
    bodyDark: "#93C5FD",
    aura: "drop-shadow(0 12px 24px rgba(59, 130, 246, 0.18))",
    scale: 0.78,
  },
  {
    fromLevel: 3,
    name: "Призрак-практикант",
    accessory: "beanie",
    bodyLight: "#BFDBFE",
    bodyDark: "#60A5FA",
    aura: "drop-shadow(0 16px 36px rgba(59, 130, 246, 0.38))",
    scale: 0.9,
  },
  {
    fromLevel: 5,
    name: "Призрак-умелец",
    accessory: "glasses",
    bodyLight: "#A5B4FC",
    bodyDark: "#6366F1",
    aura: "drop-shadow(0 16px 40px rgba(139, 92, 246, 0.45))",
    scale: 1,
  },
  {
    fromLevel: 7,
    name: "Призрак-мастер",
    accessory: "gradcap",
    bodyLight: "#93C5FD",
    bodyDark: "#3B82F6",
    aura: "drop-shadow(0 16px 44px rgba(249, 115, 22, 0.45))",
    scale: 1.08,
  },
  {
    fromLevel: 10,
    name: "Легенда 3D",
    accessory: "crown",
    bodyLight: "#93C5FD",
    bodyDark: "#2563EB",
    aura: "drop-shadow(0 18px 48px rgba(250, 204, 21, 0.55))",
    scale: 1.16,
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
    "Я скучал! Заглянем в задания?",
  ],
};
