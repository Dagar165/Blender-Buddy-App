/**
 * Отклик на касание.
 *
 * Тестировщик сказал про приложение: «не чувствуется управляемость» — знакомая
 * болезнь из геймдева, когда нажатие ничем не отзывается и палец не верит,
 * что попал. Телеграм умеет вибрировать телефоном; вне Телеграма пробуем
 * обычный navigator.vibrate, а если и его нет — молча ничего не делаем.
 *
 * Правило: вибрация сопровождает ДЕЙСТВИЕ пользователя, а не событие от нас.
 * - tap — обычное нажатие (кнопка, поглаживание);
 * - select — переключение вкладки, выбор варианта;
 * - success / warn / fail — итог: награда, «не хватает голды», ошибка сети.
 * Праздники (уровень, эволюция, медаль) зовут success один раз — иначе телефон
 * трясётся без остановки и это раздражает сильнее, чем радует.
 */

type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type NotificationType = "success" | "warning" | "error";

type TelegramHaptics = {
  impactOccurred?: (style: ImpactStyle) => void;
  notificationOccurred?: (type: NotificationType) => void;
  selectionChanged?: () => void;
};

function getTelegramHaptics(): TelegramHaptics | null {
  try {
    // @ts-ignore — глобал приходит из скрипта Телеграма
    return window.Telegram?.WebApp?.HapticFeedback ?? null;
  } catch {
    return null;
  }
}

// Запасной вариант для браузера. Длительности маленькие: вибрация должна
// читаться как щелчок, а не как звонок будильника.
function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // устройство без вибромотора — и не надо
  }
}

export function hapticTap(style: ImpactStyle = "light") {
  const haptics = getTelegramHaptics();

  if (haptics?.impactOccurred) {
    haptics.impactOccurred(style);
    return;
  }

  vibrate(style === "heavy" ? 18 : style === "medium" ? 12 : 8);
}

export function hapticSelect() {
  const haptics = getTelegramHaptics();

  if (haptics?.selectionChanged) {
    haptics.selectionChanged();
    return;
  }

  vibrate(6);
}

export function hapticSuccess() {
  const haptics = getTelegramHaptics();

  if (haptics?.notificationOccurred) {
    haptics.notificationOccurred("success");
    return;
  }

  vibrate([12, 40, 22]);
}

export function hapticWarn() {
  const haptics = getTelegramHaptics();

  if (haptics?.notificationOccurred) {
    haptics.notificationOccurred("warning");
    return;
  }

  vibrate([10, 50, 10]);
}

export function hapticFail() {
  const haptics = getTelegramHaptics();

  if (haptics?.notificationOccurred) {
    haptics.notificationOccurred("error");
    return;
  }

  vibrate([16, 60, 16, 60, 16]);
}
