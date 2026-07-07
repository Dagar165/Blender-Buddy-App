import type { GameStats } from "@/hooks/use-game-state";

/**
 * Правила редактирования (для владельца):
 * - emoji / title / description / target можно менять свободно
 * - id у существующих ачивок не менять (по нему запоминается «уже показана»)
 * - новая ачивка = новый id
 * - metric — от чего считается прогресс:
 *     "approvedQuests" — сколько всего заданий подтвердил куратор
 *     "bestStreak"     — лучшая серия дней за всё время
 *     "level"          — текущий уровень
 *     "goldSpent"      — сколько голды потрачено в магазине
 *     "itemsOwned"     — сколько предметов куплено
 */

export type AchievementMetric =
  | "approvedQuests"
  | "bestStreak"
  | "level"
  | "goldSpent"
  | "itemsOwned";

export type AchievementDefinition = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  metric: AchievementMetric;
  target: number;
};

export const ACHIEVEMENTS_CONFIG: AchievementDefinition[] = [
  // Практика — за выполненные (подтверждённые куратором) задания
  {
    id: "ach-first-quest",
    emoji: "🎯",
    title: "Первый шаг",
    description: "Выполни своё первое задание",
    metric: "approvedQuests",
    target: 1,
  },
  {
    id: "ach-quests-10",
    emoji: "🔨",
    title: "Разогрев",
    description: "Выполни 10 заданий",
    metric: "approvedQuests",
    target: 10,
  },
  {
    id: "ach-quests-25",
    emoji: "⚒️",
    title: "Мастер практики",
    description: "Выполни 25 заданий",
    metric: "approvedQuests",
    target: 25,
  },
  {
    id: "ach-quests-50",
    emoji: "🚀",
    title: "Машина продуктивности",
    description: "Выполни 50 заданий",
    metric: "approvedQuests",
    target: 50,
  },

  // Постоянство — за серию дней (считается лучшая серия за всё время)
  {
    id: "ach-streak-3",
    emoji: "✨",
    title: "Искра",
    description: "Держи серию 3 дня подряд",
    metric: "bestStreak",
    target: 3,
  },
  {
    id: "ach-streak-7",
    emoji: "🔥",
    title: "Неделя огня",
    description: "Держи серию 7 дней подряд",
    metric: "bestStreak",
    target: 7,
  },
  {
    id: "ach-streak-14",
    emoji: "⚡",
    title: "Две недели в потоке",
    description: "Держи серию 14 дней подряд",
    metric: "bestStreak",
    target: 14,
  },
  {
    id: "ach-streak-30",
    emoji: "🏆",
    title: "Железная воля",
    description: "Держи серию 30 дней подряд",
    metric: "bestStreak",
    target: 30,
  },

  // Рост — за уровни
  {
    id: "ach-level-3",
    emoji: "🌱",
    title: "Росток",
    description: "Достигни 3-го уровня",
    metric: "level",
    target: 3,
  },
  {
    id: "ach-level-5",
    emoji: "🎓",
    title: "Уверенный старт",
    description: "Достигни 5-го уровня",
    metric: "level",
    target: 5,
  },
  {
    id: "ach-level-10",
    emoji: "💎",
    title: "Десятка",
    description: "Достигни 10-го уровня",
    metric: "level",
    target: 10,
  },
  {
    id: "ach-level-20",
    emoji: "👑",
    title: "Легенда Blender",
    description: "Достигни 20-го уровня",
    metric: "level",
    target: 20,
  },

  // Хозяйство — за траты голды и покупки
  {
    id: "ach-first-buy",
    emoji: "🛍️",
    title: "Первая покупка",
    description: "Купи первый предмет в магазине",
    metric: "itemsOwned",
    target: 1,
  },
  {
    id: "ach-collector",
    emoji: "🎁",
    title: "Коллекционер",
    description: "Собери 4 предмета",
    metric: "itemsOwned",
    target: 4,
  },
  {
    id: "ach-spender",
    emoji: "💰",
    title: "Щедрая душа",
    description: "Потрать 400 голды в магазине",
    metric: "goldSpent",
    target: 400,
  },
];

export type AchievementSnapshot = Record<AchievementMetric, number>;

export type AchievementProgress = {
  definition: AchievementDefinition;
  value: number;
  target: number;
  unlocked: boolean;
  percent: number;
};

export const buildAchievementSnapshot = (source: {
  stats: GameStats;
  level: number;
  inventory: string[];
}): AchievementSnapshot => ({
  approvedQuests: source.stats.approvedQuestsTotal,
  bestStreak: source.stats.bestStreak,
  level: source.level,
  goldSpent: source.stats.goldSpent,
  itemsOwned: source.inventory.length,
});

export const evaluateAchievements = (
  snapshot: AchievementSnapshot
): AchievementProgress[] => {
  return ACHIEVEMENTS_CONFIG.map((definition) => {
    const rawValue = snapshot[definition.metric] ?? 0;
    const value = Math.min(rawValue, definition.target);

    return {
      definition,
      value,
      target: definition.target,
      unlocked: rawValue >= definition.target,
      percent: Math.min(100, (rawValue / definition.target) * 100),
    };
  });
};
