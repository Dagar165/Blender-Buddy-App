import ghostLevel1 from "@/assets/mascot/ghost-level-1.png";

/**
 * Правила редактирования (для владельца):
 * - имена стадий (name) и фразы (PET_PHRASES) можно менять свободно
 * - когда будут картинки эволюций: положи файлы в client/src/assets/mascot
 *   (например ghost-level-3.png), добавь import сверху как у ghostLevel1
 *   и поставь его в поле image нужной стадии — больше ничего менять не надо
 * - пока картинок нет, стадии отличаются свечением (aura) и размером (scale)
 * - fromLevel — с какого уровня начинается стадия; не ставь два одинаковых
 */

export type PetStage = {
  fromLevel: number;
  name: string;
  image: string;
  // Заглушка вместо арта: цвет свечения вокруг призрака (CSS filter)
  aura: string;
  // Заглушка вместо арта: призрак немного растёт с эволюцией
  scale: number;
};

export const PET_STAGES: PetStage[] = [
  {
    fromLevel: 1,
    name: "Призрачок-новичок",
    image: ghostLevel1,
    aura: "drop-shadow(0 16px 32px rgba(59, 130, 246, 0.18))",
    scale: 1,
  },
  {
    fromLevel: 3,
    name: "Призрак-практикант",
    image: ghostLevel1,
    aura: "drop-shadow(0 16px 36px rgba(59, 130, 246, 0.38))",
    scale: 1.04,
  },
  {
    fromLevel: 5,
    name: "Призрак-умелец",
    image: ghostLevel1,
    aura: "drop-shadow(0 16px 40px rgba(139, 92, 246, 0.45))",
    scale: 1.08,
  },
  {
    fromLevel: 7,
    name: "Призрак-мастер",
    image: ghostLevel1,
    aura: "drop-shadow(0 16px 44px rgba(249, 115, 22, 0.45))",
    scale: 1.12,
  },
  {
    fromLevel: 10,
    name: "Легенда 3D",
    image: ghostLevel1,
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
