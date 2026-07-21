/**
 * УХОД ЗА ПРИЗРАКОМ — правила редактирования (для владельца).
 *
 * Зачем это есть: задания дня заканчиваются за один заход, а дальше до ответа
 * куратора делать нечего. Уход даёт повод открыть приложение каждый день и при
 * этом НЕ добавляет куратору ни одной проверки — всё происходит внутри игры.
 *
 * Механика взята стандартная, тамагочи-шная: у призрака есть потребности,
 * они медленно тают со временем, а ты их пополняешь припасами.
 *
 * ГЛАВНОЕ ПРАВИЛО ЭКОНОМИКИ: уход голду ТРАТИТ, а не приносит.
 * Сначала кнопка ухода сама платила монеты — получался бесконечный фарм:
 * тыкаешь пальцем, богатеешь, Blender не открываешь. Теперь наоборот —
 * чтобы покормить призрака, нужны припасы из магазина, а голда за них
 * зарабатывается настоящими заданиями. Так забота о питомце ведёт к практике,
 * а не заменяет её. Не возвращай сюда награду за нажатие.
 *
 * Чего тут нарочно НЕТ и добавлять не надо:
 * - призрак не умирает и не болеет;
 * - за заброшенность НЕ отнимается опыт, голда и уровни;
 * - кончились припасы — призрак просто грустит и просит, ничего не теряется;
 * - никаких «ты меня бросил» — вернулся через неделю, тебе говорят «скучал».
 *   Ребёнок может уехать в лагерь или заболеть; игра, которая за это наказывает,
 *   теряет ребёнка навсегда.
 *
 * Что можно менять свободно: emoji, подписи, тексты фраз, цены, restores
 * и decayHours (за сколько часов потребность падает со 100 до 0).
 * Что менять НЕЛЬЗЯ: id потребностей и припасов — по ним хранится, что куплено
 * и когда ухаживали.
 */

export type CareNeedId = "feed" | "clean" | "play";

export type CareNeed = {
  id: CareNeedId;
  emoji: string;
  // Надпись на кнопке — что ты делаешь
  action: string;
  // Название самой потребности — что растёт
  title: string;
  // За сколько часов падает со 100 до 0
  decayHours: number;
  // Что призрак говорит, когда этой потребности не хватает
  phrases: string[];
};

// Ниже этого призрак начинает просить вслух, а на кнопке зажигается точка
export const CARE_LOW = 35;

export const CARE_NEEDS: CareNeed[] = [
  {
    id: "feed",
    emoji: "🍎",
    action: "Покормить",
    title: "Сытость",
    decayHours: 36,
    phrases: [
      "В животе рендерится пустота. Покормишь?",
      "Кажется, я съел бы целый полигон.",
      "Энергия на минимуме. Батарейку бы, а лучше перекус.",
      "Урчу так, что гизмо трясётся. Намекаю.",
      "Одна печенька — и я снова готов к великим сценам.",
    ],
  },
  {
    id: "clean",
    emoji: "🧽",
    action: "Протереть",
    title: "Чистота",
    decayHours: 72,
    phrases: [
      "Я весь в пыли, как забытый дефолтный куб.",
      "Кажется, на мне уже можно рисовать пальцем.",
      "Протри меня, пожалуйста. Хочу блестеть.",
      "Пыль оседает быстрее, чем считается рендер.",
      "Чистый призрак — счастливый призрак. Проверено.",
    ],
  },
  {
    id: "play",
    emoji: "🎲",
    action: "Поиграть",
    title: "Настроение",
    decayHours: 48,
    phrases: [
      "Считаю клетки на полу. Дошёл до многа.",
      "Ску-у-учно. Развлеки меня хоть чем-нибудь.",
      "Третий час смотрю в одну грань. Помоги.",
      "Тут так тихо, что слышно, как я думаю.",
      "Давай во что-нибудь сыграем? Я согласен на всё.",
    ],
  },
];

/**
 * ПРИПАСЫ — то, что покупается в магазине и тратится на уход.
 *
 * В каждой потребности нарочно есть дешёвый вариант и дорогой: дешёвый
 * латает дыру, дорогой закрывает шкалу целиком и выгоднее за монету.
 * restores — сколько пунктов шкалы (из 100) добавляет одна штука.
 */
export type CareSupply = {
  id: string;
  emoji: string;
  name: string;
  description: string;
  need: CareNeedId;
  cost: number;
  restores: number;
};

// Больше девяти штук одного припаса про запас не купить — незачем.
export const SUPPLY_MAX = 9;

export const CARE_SUPPLIES: CareSupply[] = [
  {
    id: "supply-apple",
    emoji: "🍏",
    name: "Яблоко",
    description: "Быстрый перекус. Хватает, чтобы призрак перестал ныть.",
    need: "feed",
    cost: 10,
    restores: 45,
  },
  {
    id: "supply-cake",
    emoji: "🍰",
    name: "Тортик",
    description: "Наедается до отвала и сияет от счастья.",
    need: "feed",
    cost: 20,
    restores: 100,
  },
  {
    id: "supply-sponge",
    emoji: "🧽",
    name: "Губка",
    description: "Пройтись по самым пыльным местам.",
    need: "clean",
    cost: 10,
    restores: 50,
  },
  {
    id: "supply-shower",
    emoji: "🚿",
    name: "Душ",
    description: "Полная помывка. Призрак скрипит от чистоты.",
    need: "clean",
    cost: 20,
    restores: 100,
  },
  {
    id: "supply-dice",
    emoji: "🎲",
    name: "Кубик",
    description: "Покидать кубик вдвоём — уже развлечение.",
    need: "play",
    cost: 10,
    restores: 45,
  },
  {
    id: "supply-console",
    emoji: "🎮",
    name: "Приставка",
    description: "Час игр — и настроение до потолка.",
    need: "play",
    cost: 20,
    restores: 100,
  },
];

/**
 * Стартовый набор: чтобы новичок не упёрся в пустой инвентарь раньше, чем
 * заработает первую голду. Выдаётся один раз при первом запуске.
 */
export const STARTER_SUPPLIES: Record<string, number> = {
  "supply-apple": 2,
  "supply-sponge": 1,
  "supply-dice": 1,
};

export const getCareNeed = (id: CareNeedId) =>
  CARE_NEEDS.find((need) => need.id === id) ?? CARE_NEEDS[0];

export const getCareSupply = (id: string) =>
  CARE_SUPPLIES.find((supply) => supply.id === id) ?? null;

export const getSuppliesForNeed = (needId: CareNeedId) =>
  CARE_SUPPLIES.filter((supply) => supply.need === needId);

/**
 * Насколько потребность полна прямо сейчас: 100 — только что позаботились,
 * 0 — давно забыли. Считается от времени последнего ухода, поэтому таймеры
 * не нужны и всё честно тикает, даже когда приложение закрыто.
 */
export function getNeedLevel(
  lastCareIso: string | null,
  decayHours: number,
  now: number = Date.now()
): number {
  if (!lastCareIso) return 100;

  const last = new Date(lastCareIso).getTime();
  if (!Number.isFinite(last)) return 100;

  const hoursPassed = (now - last) / (1000 * 60 * 60);
  const level = 100 - (hoursPassed / decayHours) * 100;

  return Math.max(0, Math.min(100, Math.round(level)));
}

/**
 * Приложили припас — шкала подросла на restores пунктов.
 *
 * Уровень мы нигде не храним, только момент последнего ухода, поэтому
 * «поднять шкалу» = сдвинуть этот момент ближе к настоящему. Возвращает
 * новое время для записи в стейт.
 */
export function applyRestore(
  lastCareIso: string | null,
  decayHours: number,
  restores: number,
  now: number = Date.now()
): string {
  const current = getNeedLevel(lastCareIso, decayHours, now);
  const next = Math.min(100, current + restores);
  const hoursBack = ((100 - next) / 100) * decayHours;

  return new Date(now - hoursBack * 60 * 60 * 1000).toISOString();
}

const pickPhrase = (phrases: string[], seed: number) =>
  phrases[Math.floor(Math.abs(seed)) % phrases.length];

// Что призрак говорит, когда всё в порядке
export const CARE_CONTENT_PHRASES = [
  "Сыт, поглажен, доволен. Красота.",
  "Вот это жизнь. Ничего не болит, всё блестит.",
  "Сижу, свечусь. Всё как надо.",
  "Идеально. Даже дефолтный куб сегодня милый.",
  "Мне хорошо. И тебе желаю того же.",
];

// …и когда всё в порядке, но пора бы за дело
export const CARE_BLENDER_PHRASES = [
  "Руки чешутся что-нибудь смоделить. У тебя тоже?",
  "Blender там пылится. Стряхнём?",
  "Я готов творить. Осталось найти творца — тебя.",
  "Одна сценка ждёт. Заглянем на минутку?",
  "Чувствую — сегодня получится что-то крутое.",
];

/**
 * Что призрак говорит про своё самочувствие. Просит про самую просевшую
 * потребность — про все сразу ныть некрасиво. Если всё хорошо, иногда
 * подталкивает открыть Blender.
 */
export function getCarePhrase(
  levels: Record<CareNeedId, number>,
  rawSeed: number
): string | null {
  const seed = Math.floor(Math.abs(rawSeed));

  const lowest = CARE_NEEDS.reduce((worst, need) =>
    levels[need.id] < levels[worst.id] ? need : worst
  );

  if (levels[lowest.id] < CARE_LOW) {
    return pickPhrase(lowest.phrases, seed);
  }

  const allGood = CARE_NEEDS.every((need) => levels[need.id] >= 70);
  if (!allGood) return null;

  return seed % 2 === 0
    ? pickPhrase(CARE_CONTENT_PHRASES, seed)
    : pickPhrase(CARE_BLENDER_PHRASES, seed);
}
