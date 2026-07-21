import {
  WARMUP_QUESTS,
  WEEKEND_LIMIT,
  WEEKEND_QUESTS,
  type QuestDefinition,
  type QuestTab,
} from "@/lib/quests-config";
import {
  getNextStep,
  getPaceIndex,
  getWeekProject,
  isProjectDay,
} from "@/lib/projects-config";

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
 * Разминка дня: одна на каждый будний день, за неделю не повторяется.
 *
 * Список тасуется ключом НЕДЕЛИ, а не дня, и из него берётся элемент по
 * номеру шага — поэтому за пять будних дней выпадают пять разных разминок,
 * а на следующей неделе порядок другой.
 */
function getWarmupForStep(stepIndex: number, weekCycleKey: string) {
  if (WARMUP_QUESTS.length === 0) return null;

  const shuffled = shuffleQuests(WARMUP_QUESTS, `warmup-${weekCycleKey}`);

  return shuffled[stepIndex % shuffled.length] ?? null;
}

/**
 * Задания дня и недели.
 *
 * Неделя — один большой проект (projects-config.ts). Будний день даёт два
 * задания: шаг проекта (главное дело дня) и короткую разминку на 5–10 минут,
 * чтобы день не выглядел неподъёмным и всегда был выполним.
 * Суббота и воскресенье оставлены свободными, но задания там всё же есть —
 * иначе серия дней сгорала бы каждые выходные.
 */
export function getActiveQuestsForTab(
  tab: QuestTab,
  cycleKey: string,
  weekCycleKey?: string,
  // Шаги проекта, уже сданные и отправленные на проверку за эту неделю.
  weekDoneIds: string[] = [],
  weekPendingIds: string[] = []
): QuestDefinition[] {
  // Во вкладке «Неделя» сдавать нечего: проект закрывается сам, когда куратор
  // одобрит последний шаг. Там показывается только путь недели.
  if (tab === "weekly") return [];

  const dateKey = cycleKey.replace("daily-", "");

  // Выходной — отдыхаем от моделинга: смотрим, разбираем, наводим порядок.
  if (!isProjectDay(dateKey) || !weekCycleKey) {
    return getActiveQuestsFromPool(WEEKEND_QUESTS, cycleKey, WEEKEND_LIMIT);
  }

  const project = getWeekProject(weekCycleKey);
  const next = getNextStep(project, weekDoneIds, weekPendingIds);
  // Календарь больше не решает, КАКОЙ шаг выдать, но остаётся потолком:
  // отстал — нагонишь, а вперёд паровоза не убежишь. Иначе весь проект
  // закрывался за один вечер, и неделя переставала быть неделей.
  const openUpTo = getPaceIndex(dateKey);
  // Разминка своя на каждый будний день, поэтому считается по календарю,
  // а не по номеру шага: иначе догоняющий получал бы одну и ту же дважды.
  const warmup = getWarmupForStep(getPaceIndex(dateKey), weekCycleKey);

  const warmupQuest = warmup
    ? [
        {
          ...warmup,
          stepLabel: "Разминка — на пять минут",
          kind: "warmup" as const,
        },
      ]
    : [];

  // Шаги кончились или сегодняшний уже сдан — остаётся разминка.
  if (!next || next.index > openUpTo) return warmupQuest;

  return [
    {
      id: next.step.id,
      title: next.step.title,
      description: next.step.description,
      result: next.step.result,
      stepLabel: `Шаг ${next.index + 1} из ${project.steps.length} — ${project.title}`,
      kind: "step" as const,
      xpReward: next.step.xpReward,
      goldReward: next.step.goldReward,
    },
    ...warmupQuest,
  ];
}
