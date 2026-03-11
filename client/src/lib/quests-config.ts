export type QuestTab = "daily" | "weekly";

export type QuestDefinition = {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  goldReward: number;
};

type QuestTabContent = {
  tabLabel: string;
  tabHint: string;
  sectionTitle: string;
  sectionSubtitle: string;
};

type QuestPageContent = {
  title: string;
  subtitle: string;
};

type QuestLimits = Record<QuestTab, number>;

export type QuestsConfig = {
  page: QuestPageContent;
  tabs: Record<QuestTab, QuestTabContent>;
  limits: QuestLimits;
  pools: Record<QuestTab, QuestDefinition[]>;
};

/**
 * Правила:
 * - title / description / xpReward / goldReward можно менять свободно
 * - id не меняй у уже существующих заданий без необходимости
 * - если нужен новый квест, создавай новый id
 */
export const QUESTS_CONFIG: QuestsConfig = {
  page: {
    title: "Задания",
    subtitle: "Daily и weekly цели без сброса прогресса профиля",
  },

  tabs: {
    daily: {
      tabLabel: "Daily",
      tabHint: "Каждый день",
      sectionTitle: "Daily",
      sectionSubtitle: "Обновляются каждый день",
    },
    weekly: {
      tabLabel: "Weekly",
      tabHint: "Каждую неделю",
      sectionTitle: "Weekly",
      sectionSubtitle: "Обновляются каждую неделю",
    },
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
