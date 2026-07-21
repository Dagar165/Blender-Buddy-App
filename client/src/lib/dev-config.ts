/**
 * Отладочная панель владельца: поставить любой уровень, выдать голду,
 * пересмотреть эволюцию. Нужна, чтобы смотреть, как выглядит игра на
 * разных ступенях, не проходя её заново.
 *
 * Кнопка «Панель владельца» видна на вкладке «Профиль» — но ТОЛЬКО тем,
 * кто перечислен ниже. У остальных её нет в интерфейсе вообще.
 *
 * Как добавить себе доступ: впиши свой ник в Telegram без «собаки»
 * (регистр не важен) или числовой id. Ник надёжнее — его видно сразу,
 * id пришлось бы где-то подсматривать.
 */
export const DEV_USERNAMES: string[] = ["S_Fenchin"];

export const DEV_USER_IDS: number[] = [];

export const isDevUser = (
  telegramUserId: number | null,
  telegramUsername: string | null
): boolean => {
  // Вне Telegram (обычный браузер) панель открыта — там нет учеников,
  // это режим разработки.
  if (telegramUserId === null && telegramUsername === null) return true;

  if (telegramUserId !== null && DEV_USER_IDS.includes(telegramUserId)) {
    return true;
  }

  if (telegramUsername) {
    const normalized = telegramUsername.replace(/^@/, "").toLowerCase();

    return DEV_USERNAMES.some(
      (name) => name.replace(/^@/, "").toLowerCase() === normalized
    );
  }

  return false;
};
