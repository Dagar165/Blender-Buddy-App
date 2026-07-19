export type QuestTab = "daily" | "weekly";

export type QuestDefinition = {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  goldReward: number;
  // Что показать куратору на скриншоте (у шагов проекта недели).
  result?: string;
  // «Шаг 2 из 5 — Меч героя»: связывает день с проектом недели.
  stepLabel?: string;
};

type QuestTabContent = {
  tabLabel: string;
};

type QuestLimits = Record<QuestTab, number>;

export type QuestsConfig = {
  tabs: Record<QuestTab, QuestTabContent>;
  limits: QuestLimits;
  pools: Record<QuestTab, QuestDefinition[]>;
};

/**
 * ЗАДАНИЯ ВЫХОДНОГО ДНЯ.
 *
 * В субботу и воскресенье шагов проекта нет — это выходной. Но совсем без
 * заданий серия дней сгорала бы каждую неделю, поэтому тут лежит своя пачка:
 * не моделить, а смотреть, разбирать и наводить порядок. Насмотренность —
 * такая же часть профессии, и на неё обычно не хватает времени в будни.
 *
 * Правило то же: у каждого задания есть видимый результат, который ученик
 * показывает куратору скриншотом. Иначе проверять нечего.
 *
 * Показываем WEEKEND_LIMIT штук из списка, выбор меняется каждый день.
 */
export const WEEKEND_LIMIT = 2;

export const WEEKEND_QUESTS: QuestDefinition[] = [
  {
    id: "weekend-inspiration",
    title: "Найди работу, которая зацепила",
    description:
      "Полистай чужие 3D-работы — в нашем канале, на ArtStation или где сам смотришь. Выбери одну, которая понравилась больше всех.",
    result: "Скриншот работы и одна строчка: что именно тебя в ней зацепило.",
    xpReward: 60,
    goldReward: 25,
  },
  {
    id: "weekend-breakdown",
    title: "Разбери, как это сделано",
    description:
      "Возьми любую понравившуюся 3D-работу и подумай, из каких простых форм её можно собрать. Куб, цилиндр, шар — что там в основе?",
    result: "Скриншот работы и 2–3 предложения твоего разбора.",
    xpReward: 60,
    goldReward: 25,
  },
  {
    id: "weekend-references",
    title: "Собери папку референсов",
    description:
      "Придумай, что хочешь смоделить когда-нибудь, и накидай 5–10 картинок по теме. Пусть лежат наготове.",
    result: "Скриншот папки или доски с собранными картинками.",
    xpReward: 60,
    goldReward: 25,
  },
  {
    id: "weekend-timelapse",
    title: "Посмотри, как моделит другой",
    description:
      "Найди таймлапс или урок, где кто-то собирает модель, и посмотри минут десять. Следи за руками, а не за результатом.",
    result: "Скриншот видео и один приём, который ты подметил.",
    xpReward: 60,
    goldReward: 25,
  },
  {
    id: "weekend-cleanup",
    title: "Наведи порядок в старой сцене",
    description:
      "Открой любой свой прошлый проект: переименуй объекты понятно, удали лишнее, сохрани заново.",
    result: "Скриншот списка объектов (Outliner) с понятными именами.",
    xpReward: 60,
    goldReward: 25,
  },
  {
    id: "weekend-show-work",
    title: "Покажи свою работу",
    description:
      "Выложи любую свою сцену в чат школы — даже если кажется, что недоделано. Именно так и растут быстрее.",
    result: "Скриншот твоей публикации.",
    xpReward: 60,
    goldReward: 25,
  },
];

/**
 * ВНИМАНИЕ, что тут живое, а что запас:
 *
 * - tabLabel — надписи на вкладках, видны на экране;
 * - pools — СТАРЫЕ задания, сейчас НЕ показываются нигде. В будни выдаются
 *   шаги проекта недели (projects-config.ts), на выходных — WEEKEND_QUESTS.
 *   Список оставлен как запас: если понадобится вернуть свободные задания,
 *   всё готово. Правки в нём на экран не влияют.
 *
 * Правила для запаса и для WEEKEND_QUESTS:
 * - title / description / xpReward / goldReward можно менять свободно
 * - id не меняй у уже существующих заданий без необходимости
 * - если нужен новый квест, создавай новый id
 */
export const QUESTS_CONFIG: QuestsConfig = {
  tabs: {
    daily: { tabLabel: "День" },
    weekly: { tabLabel: "Неделя" },
  },

  limits: {
    daily: 3,
    weekly: 2,
  },

  pools: {
    daily: [
      {
        id: "daily-apple",
        title: "Смоделируй яблоко",
        description:
          "Используй Subdivision Surface, чтобы сделать аккуратное лоу-поли яблоко.",
        xpReward: 50,
        goldReward: 20,
      },
      {
        id: "daily-extrude",
        title: "Потренируй Extrude",
        description:
          "Сделай простую форму из куба через Extrude и пару дополнительных граней.",
        xpReward: 70,
        goldReward: 30,
      },
      {
        id: "daily-material",
        title: "Добавь материал",
        description:
          "Назначь объекту материал и настрой базовый цвет, roughness и metallic.",
        xpReward: 60,
        goldReward: 25,
      },
      {
        id: "daily-bevel",
        title: "Потренируй Bevel",
        description:
          "Скругли края объекта через Bevel и добейся более приятного силуэта.",
        xpReward: 55,
        goldReward: 20,
      },
      {
        id: "daily-loop-cuts",
        title: "Сделай Loop Cuts",
        description:
          "Добавь несколько Loop Cut'ов и измени форму объекта через масштаб и перемещение.",
        xpReward: 65,
        goldReward: 25,
      },
      {
        id: "daily-shade-smooth",
        title: "Улучши сглаживание",
        description:
          "Примени Shade Smooth и проверь, нужен ли Auto Smooth для аккуратного вида.",
        xpReward: 45,
        goldReward: 15,
      },
      {
        id: "daily-reference",
        title: "Собери референсы",
        description:
          "Найди 3–5 референсов для следующей модели и выбери понятный силуэт для практики.",
        xpReward: 40,
        goldReward: 15,
      },
      {
        id: "daily-lighting",
        title: "Поставь базовый свет",
        description:
          "Добавь один источник света и настрой сцену так, чтобы объект читался объёмнее.",
        xpReward: 60,
        goldReward: 25,
      },
      {
        id: "daily-scale-check",
        title: "Проверь масштаб",
        description:
          "Пройдись по размеру объекта, проверь пропорции и при необходимости примени Scale.",
        xpReward: 50,
        goldReward: 20,
      },
      {
        id: "daily-render-preview",
        title: "Сделай превью-рендер",
        description:
          "Собери быстрый аккуратный ракурс и сохрани один тестовый рендер своей модели.",
        xpReward: 75,
        goldReward: 30,
      },
    ],

    weekly: [
      {
        id: "weekly-prop",
        title: "Собери мини-проп",
        description:
          "Сделай один законченный объект: кружку, ящик, лампу или любой другой простой prop.",
        xpReward: 180,
        goldReward: 90,
      },
      {
        id: "weekly-scene",
        title: "Оформи мини-сцену",
        description:
          "Собери небольшую сцену из нескольких объектов, добавь свет и базовую композицию.",
        xpReward: 220,
        goldReward: 120,
      },
      {
        id: "weekly-lowpoly-set",
        title: "Собери low-poly набор",
        description:
          "Сделай набор из 3 связанных low-poly объектов в одном стиле, например еда, инструменты или декор.",
        xpReward: 200,
        goldReward: 100,
      },
      {
        id: "weekly-material-study",
        title: "Изучи материалы",
        description:
          "Сделай 3 разных материала для одной формы: пластик, металл и матовая поверхность.",
        xpReward: 190,
        goldReward: 95,
      },
      {
        id: "weekly-silhouette",
        title: "Прокачай силуэт",
        description:
          "Сделай объект с читаемым силуэтом и доведи форму до состояния, где он узнаётся без текстур.",
        xpReward: 210,
        goldReward: 110,
      },
      {
        id: "weekly-render-shot",
        title: "Подготовь красивый шот",
        description:
          "Возьми готовую модель и доведи её до аккуратного финального кадра со светом и композицией.",
        xpReward: 230,
        goldReward: 125,
      },
    ],
  },
};
