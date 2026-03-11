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

type QuestsConfig = {
  page: {
    title: string;
    subtitle: string;
  };
  tabs: Record<QuestTab, QuestTabContent>;
  pools: Record<QuestTab, QuestDefinition[]>;
};

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
    ],
  },
};
