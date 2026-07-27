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

/**
 * ЧАТ ШКОЛЫ — куда ребёнок скидывает работы. ЭТО НЕ КАНАЛ.
 *
 * ══ ПОЧЕМУ ДВА РАЗНЫХ АДРЕСА ══
 *
 * Владелец 27.07: «у нас везде ссылка идёт не на чат, а именно на группу
 * в тг. Там хоть и есть возможность комментить посты, но это непонятно
 * будет куда скидывать».
 *
 * Он прав, и это была настоящая поломка: во всём приложении жил ОДИН
 * телеграмный адрес, и на него вели обе разные просьбы. Призрак говорит
 * «скинь работу в чат, пацаны глянут», ребёнок нажимает — и попадает
 * в ленту новостей, где выкладывать нечего и постить нельзя. Просьба,
 * ради которой надо идти искать, — не просьба.
 *
 * Теперь адресов два, и у каждого своя работа:
 * - `SCHOOL_CHAT` (этот) — ЖИВОЙ РАЗГОВОР. Сюда ведут все «скинь работу»,
 *   «спроси, если застрял», «там голосуют». Все двери в чат по приложению
 *   берут адрес отсюда через `COMMUNITY_LINK` в `community-config.ts` —
 *   меняешь одну строку, меняется везде;
 * - `SOCIAL_LINKS` ниже — витрина: канал новостей, YouTube, ВК. Читать,
 *   а не разговаривать.
 *
 * ⚠️ ПОКА ЗДЕСЬ ВРЕМЕННО СТОИТ АДРЕС КАНАЛА. Настоящий адрес чата ждём
 * от владельца — это открытый вопрос в реестре. Заменить надо только
 * строку `url` ниже, больше нигде ничего не трогать.
 */
export const SCHOOL_CHAT: OutboundLink = {
  id: "school-chat",
  title: "Чат школы",
  subtitle: "Показать работу и спросить, если застрял",
  url: "https://t.me/jcenterskids",
  kind: "telegram",
  emoji: "💬",
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

// Витрина школы: сюда ходят читать и смотреть. Разговор — в SCHOOL_CHAT выше.
export const SOCIAL_LINKS: OutboundLink[] = [
  {
    id: "telegram",
    title: "Telegram",
    subtitle: "Канал школы: новости и разборы",
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
