import {
  QUESTS_CONFIG,
  type QuestDefinition,
  type QuestTab,
} from "@/lib/quests-config";
import { getStepForDate, getWeekProject } from "@/lib/projects-config";

function clampLimit(limit: number, poolLength: number) {
  if (poolLength <= 0) return 0;
  return Math.max(1, Math.min(limit, poolLength));
}

function createSeedFromString(value: string) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash) || 1;
}

function createRandom(seed: number) {
  let state = seed;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;

    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleQuests(quests: QuestDefinition[], seedKey: string) {
  const random = createRandom(createSeedFromString(seedKey));
  const result = [...quests];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

export function getActiveQuestsFromPool(
  quests: QuestDefinition[],
  cycleKey: string,
  limit: number
) {
  const safeLimit = clampLimit(limit, quests.length);
  const shuffled = shuffleQuests(quests, cycleKey);

  return shuffled.slice(0, safeLimit);
}

/**
 * Задания дня и недели.
 *
 * Неделя — один большой проект (projects-config.ts). Будние дни дают по
 * одному его шагу: день служит цели недели, а не живёт сам по себе.
 * Суббота и воскресенье оставлены свободными, но задания там всё же есть —
 * иначе серия дней сгорала бы каждые выходные.
 */
export function getActiveQuestsForTab(
  tab: QuestTab,
  cycleKey: string,
  weekCycleKey?: string
): QuestDefinition[] {
  if (tab === "weekly") {
    const project = getWeekProject(cycleKey);

    return [
      {
        id: project.id,
        title: project.title,
        description: project.why,
        result: "Итоговый рендер проекта — то, что получилось за неделю.",
        xpReward: project.xpReward,
        goldReward: project.goldReward,
      },
    ];
  }

  const dateKey = cycleKey.replace("daily-", "");
  const stepIndex = getStepForDate(dateKey);

  // Выходной — свободные задания из общего списка.
  if (stepIndex === null || !weekCycleKey) {
    return getActiveQuestsFromPool(
      QUESTS_CONFIG.pools.daily,
      cycleKey,
      QUESTS_CONFIG.limits.daily
    );
  }

  const project = getWeekProject(weekCycleKey);
  const step = project.steps[stepIndex];

  if (!step) {
    return getActiveQuestsFromPool(
      QUESTS_CONFIG.pools.daily,
      cycleKey,
      QUESTS_CONFIG.limits.daily
    );
  }

  return [
    {
      id: step.id,
      title: step.title,
      description: step.description,
      result: step.result,
      stepLabel: `Шаг ${stepIndex + 1} из ${project.steps.length} — ${project.title}`,
      xpReward: step.xpReward,
      goldReward: step.goldReward,
    },
  ];
}
