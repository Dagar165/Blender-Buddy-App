/**
 * Ссылки наружу (владелец правит сам).
 * - kind: "telegram" — открывается внутри Телеграма (openTelegramLink),
 *   "web" — во внешнем браузере (openLink). Для t.me всегда ставь "telegram".
 * - порядок в массиве = порядок на экране.
 */

export type OutboundLink = {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  kind: "telegram" | "web";
  emoji: string;
};

// Бот-помощник по Blender — отдельно и первым: это польза, а не соцсеть.
export const HELPER_BOT: OutboundLink = {
  id: "helper-bot",
  title: "Спроси про Blender",
  subtitle: "Бот-помощник ответит на вопрос по программе",
  url: "https://t.me/VozhatyBot",
  kind: "telegram",
  emoji: "🤖",
};

export const SOCIAL_LINKS: OutboundLink[] = [
  {
    id: "telegram",
    title: "Telegram",
    subtitle: "Новости школы",
    url: "https://t.me/jcenterskids",
    kind: "telegram",
    emoji: "✈️",
  },
  {
    id: "youtube",
    title: "YouTube",
    subtitle: "Уроки по Blender",
    url: "https://www.youtube.com/@JKidsBlender",
    kind: "web",
    emoji: "▶️",
  },
  {
    id: "vk",
    title: "ВКонтакте",
    subtitle: "Мы и там тоже",
    url: "https://vk.ru/jcenterskids",
    kind: "web",
    emoji: "🔵",
  },
];

// Внутри мини-аппа обычные ссылки ведут себя плохо — открываем через Telegram.
export function openOutboundLink(link: OutboundLink) {
  try {
    // @ts-ignore
    const webApp = window.Telegram?.WebApp;

    if (link.kind === "telegram" && webApp?.openTelegramLink) {
      webApp.openTelegramLink(link.url);
      return;
    }

    if (webApp?.openLink) {
      webApp.openLink(link.url);
      return;
    }
  } catch {
    // вне Телеграма или старый клиент — открываем обычной вкладкой
  }

  window.open(link.url, "_blank", "noopener,noreferrer");
}
