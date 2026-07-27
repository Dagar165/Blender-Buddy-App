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
 *     "quizDays"       — сколько ДНЕЙ квиз пройден целиком (все 5 вопросов)
 *     "gamesFinished"  — сколько партий в мини-игре доиграно до конца
 *
 * Про две последние: они считают ЗАВЕРШЕНИЕ, а не успех. Квиз засчитывается
 * дню, в котором ответили на все вопросы (верность ответов не важна — за неё
 * платят опытом отдельно), партия — той, где кончились ходы. Так и просил
 * владелец: «ребёнок проиграл первый раз, но ачивку получил».
 */

export type AchievementMetric =
  | "approvedQuests"
  | "bestStreak"
  | "level"
  | "goldSpent"
  | "itemsOwned"
  | "quizDays"
  | "gamesFinished";

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

  /**
   * Квиз — просьба владельца 27.07: «квиз закончился и всё. Надо как-то
   * визуально точку поставить для ребёнка».
   *
   * Считаются ДНИ, а не ответы: медаль ставит точку в конце дня квиза.
   * Первая даётся за самый первый пройденный день — именно её он просил
   * «точно», остальные растянуты, чтобы было куда идти дальше.
   */
  {
    id: "ach-quiz-1",
    emoji: "🧠",
    title: "Проверил себя",
    description: "Пройди квиз дня целиком — все пять вопросов",
    metric: "quizDays",
    target: 1,
  },
  {
    id: "ach-quiz-3",
    emoji: "📚",
    title: "Втянулся",
    description: "Пройди квиз целиком в три разных дня",
    metric: "quizDays",
    target: 3,
  },
  {
    id: "ach-quiz-10",
    emoji: "🎓",
    title: "Знаток",
    description: "Пройди квиз целиком в десять разных дней",
    metric: "quizDays",
    target: 10,
  },
  {
    id: "ach-quiz-30",
    emoji: "🦉",
    title: "Ходячий справочник",
    description: "Пройди квиз целиком в тридцать разных дней",
    metric: "quizDays",
    target: 30,
  },

  /**
   * Мини-игра. Медаль за ДОИГРАННУЮ партию, а не за победу: 2048 с первого
   * раза не собирает никто, а точку в конце первой партии поставить надо.
   */
  {
    id: "ach-game-1",
    emoji: "🕹️",
    title: "Первая партия",
    description: "Доиграй партию в мини-игре до конца",
    metric: "gamesFinished",
    target: 1,
  },
  {
    id: "ach-game-3",
    emoji: "👾",
    title: "Ещё разок",
    description: "Доиграй три партии",
    metric: "gamesFinished",
    target: 3,
  },
  {
    id: "ach-game-10",
    emoji: "🎮",
    title: "Завсегдатай",
    description: "Доиграй десять партий",
    metric: "gamesFinished",
    target: 10,
  },
  {
    id: "ach-game-30",
    emoji: "🏅",
    title: "Мастер плиток",
    description: "Доиграй тридцать партий",
    metric: "gamesFinished",
    target: 30,
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
  quizDays: source.stats.quizDaysDone,
  gamesFinished: source.stats.gamesFinished,
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
