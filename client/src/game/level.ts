/**
 * Кривая опыта: сколько XP стоит каждый уровень и где ученик находится сейчас.
 * Один файл на всю арифметику уровней — больше её нигде нет.
 */

/**
 * Кривая опыта (пересчитана 19.07.2026 по решению владельца).
 *
 * Считали так: идеальный будний день = шаг проекта недели (150 XP)
 * + разминка (40) + квиз (20) + поглаживания (10) + доля самого проекта
 * (400 XP за неделю ≈ 57) ≈ 277 XP, плюс бонус серии до +50% и зелье ×2 →
 * около 540–570 XP в день у отличника. 30-й уровень стоит ~23 000 XP, то есть
 * берётся примерно за 43 дня — полтора месяца при соблюдении ВСЕХ критериев,
 * как и просил владелец (20.07: разминка добавила ~40 XP в день, срок
 * сдвинулся с 50 дней к 43 — это ещё внутри «полтора-два месяца»).
 *
 * Если будешь менять награды за шаги (projects-config.ts) — пересчитай и это.
 *
 * Форма кривой: цена уровня растёт линейно (120 XP за 2-й, +48 XP за каждый
 * следующий). Первые уровни намеренно быстрые — новичок должен сразу увидеть
 * движение; растянута середина и верх.
 *
 * Если менять — держи в голове обе стороны: и отличника с зельями (~460 XP/день),
 * и обычного ребёнка с одним заданием (~80 XP/день).
 */
export const LEVEL_THRESHOLDS = [
  0,     // level 1
  120,   // level 2
  290,   // level 3
  500,   // level 4
  770,   // level 5
  1080,  // level 6
  1440,  // level 7
  1850,  // level 8
  2300,  // level 9
  2800,  // level 10
  3360,  // level 11
  3960,  // level 12
  4600,  // level 13
  5300,  // level 14
  6050,  // level 15
  6840,  // level 16
  7680,  // level 17
  8570,  // level 18
  9500,  // level 19
  10490, // level 20
  11520, // level 21
  12600, // level 22
  13730, // level 23
  14900, // level 24
  16130, // level 25
  17400, // level 26
  18720, // level 27
  20090, // level 28
  21500, // level 29
  22970, // level 30
];

export type LevelData = {
  level: number;
  currentLevelStartXp: number;
  nextLevelXp: number;
  progressInLevel: number;
  requiredForNextLevel: number;
  xpToNextLevel: number;
  xpProgress: number;
};

export const getLevelData = (totalXp: number): LevelData => {
  let level = 1;

  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }

  const currentLevelStartXp = LEVEL_THRESHOLDS[level - 1];
  const nextLevelXp = LEVEL_THRESHOLDS[level] ?? currentLevelStartXp;

  if (level >= LEVEL_THRESHOLDS.length) {
    return {
      level,
      currentLevelStartXp,
      nextLevelXp: currentLevelStartXp,
      progressInLevel: totalXp - currentLevelStartXp,
      requiredForNextLevel: 0,
      xpToNextLevel: 0,
      xpProgress: 100,
    };
  }

  const progressInLevel = totalXp - currentLevelStartXp;
  const requiredForNextLevel = nextLevelXp - currentLevelStartXp;
  const xpToNextLevel = nextLevelXp - totalXp;
  const xpProgress =
    requiredForNextLevel > 0
      ? Math.min(100, (progressInLevel / requiredForNextLevel) * 100)
      : 100;

  return {
    level,
    currentLevelStartXp,
    nextLevelXp,
    progressInLevel,
    requiredForNextLevel,
    xpToNextLevel,
    xpProgress,
  };
};

