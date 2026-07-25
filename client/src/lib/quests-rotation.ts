import { createRandom, createSeedFromString } from "@/lib/random";
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
  isWeekend,
  type ProjectStep,
  type WeeklyProject,
} from "@/lib/projects-config";

function clampLimit(limit: number, poolLength: number) {
  if (poolLength <= 0) return 0;
  return Math.max(1, Math.min(limit, poolLength));
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

// Шаг проекта в виде карточки задания. Одна на всех, чтобы шаг «на проверке»
// и шаг «делай сейчас» выглядели одинаково — это один и тот же шаг.
function toStepQuest(
  project: WeeklyProject,
  step: ProjectStep,
  index: number
): QuestDefinition {
  return {
    id: step.id,
    title: step.title,
    description: step.description,
    result: step.result,
    stepLabel: `Шаг ${index + 1} из ${project.steps.length} — ${project.title}`,
    kind: "step",
    xpReward: step.xpReward,
    goldReward: step.goldReward,
  };
}

// Разминка буднего дня в виде карточки задания.
function buildWarmupQuests(
  stepIndex: number,
  weekCycleKey: string
): QuestDefinition[] {
  const warmup = getWarmupForStep(stepIndex, weekCycleKey);

  if (!warmup) return [];

  return [
    {
      ...warmup,
      stepLabel: "Разминка — на пять минут",
      kind: "warmup" as const,
    },
  ];
}

/**
 * Задания дня и недели.
 *
 * Неделя — один большой проект (projects-config.ts), и шаг этого проекта
 * даётся КАЖДЫЙ день, включая выходные. Рядом с ним всегда стоит второе,
 * лёгкое задание, чтобы день не выглядел неподъёмным: в будни это разминка
 * на пять минут, в выходные — задание на насмотренность (смотреть и
 * разбирать, а не моделить).
 *
 * ЧТО ЗДЕСЬ БЫЛО СЛОМАНО (правка 25.07). Раньше суббота и воскресенье
 * возвращали ТОЛЬКО свободные задания, а шаг проекта не выдавался вовсе.
 * Ребёнок, добравшийся до проекта в выходные, упирался в стену: во вкладке
 * «Неделя» шаг горел «сейчас», а сдать его было негде. Теперь выходные —
 * это время догнать: календарь открывает в них все пять шагов (getPaceIndex),
 * а проект закрывается в воскресенье.
 *
 * Порядок карточек: сначала то, что у куратора, потом шаг на сегодня,
 * потом лёгкое задание. Оранжевая кнопка на экране одна — это шаг.
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

  // Проекта нет (ключ недели не передали) — остаются свободные задания.
  if (!weekCycleKey) {
    return getActiveQuestsFromPool(WEEKEND_QUESTS, cycleKey, WEEKEND_LIMIT);
  }

  const project = getWeekProject(weekCycleKey);
  // Шаг «на проверке» держит очередь все семь дней: getNextStep вернёт null,
  // пока куратор не ответит. Календарь ниже — вторая, отдельная дверь.
  const next = getNextStep(project, weekDoneIds, weekPendingIds);
  // Календарь не решает, КАКОЙ шаг выдать, но остаётся потолком: отстал —
  // нагонишь, а вперёд паровоза не убежишь. В выходные потолок снят совсем.
  const openUpTo = getPaceIndex(dateKey);
  // Шаг, который реально можно делать сегодня: и очередь до него дошла,
  // и календарь пустил.
  const stepToday = next && next.index <= openUpTo ? next : null;

  // Отправленный куратору шаг остаётся на виду, просто со статусом
  // «на проверке». Раньше он исчезал: ребёнок сдавал работу и видел вместо
  // неё пустоту — как будто её не приняли, а куратор ещё даже не смотрел.
  // Очередь такой шаг ДЕРЖИТ: getNextStep вернёт null, пока он не проверен,
  // поэтому следующий рядом не появится (см. projects-config).
  const pendingQuests = weekPendingIds
    .map((id) => {
      const index = project.steps.findIndex((step) => step.id === id);
      return index < 0 ? null : toStepQuest(project, project.steps[index], index);
    })
    .filter((quest): quest is QuestDefinition => quest !== null);

  // Второе задание дня. Разминка своя на каждый будний день, поэтому считается
  // по календарю, а не по номеру шага: иначе догоняющий получал бы одну и ту же
  // дважды. В выходные вместо неё — задания на насмотренность; когда шага
  // на сегодня нет (всё сдано или ждём куратора), их выдаётся полная пачка,
  // иначе выходной остался бы пустым.
  const companionQuests = isWeekend(dateKey)
    ? getActiveQuestsFromPool(
        WEEKEND_QUESTS,
        cycleKey,
        stepToday ? 1 : WEEKEND_LIMIT
      )
    : buildWarmupQuests(openUpTo, weekCycleKey);

  if (!stepToday) return [...pendingQuests, ...companionQuests];

  // Шаг, который делаем СЕЙЧАС, идёт первым — это единственная оранжевая
  // кнопка экрана. Отправленные лежат под ним: в выходные их может набраться
  // несколько подряд, и главное дело дня не должно оказаться под стопкой
  // того, что уже сделано.
  return [
    toStepQuest(project, stepToday.step, stepToday.index),
    ...pendingQuests,
    ...companionQuests,
  ];
}
