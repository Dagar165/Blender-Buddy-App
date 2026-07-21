/**
 * Работа с датами. Всё считается по МЕСТНОМУ времени ученика, не по UTC:
 * «сегодня» для серии дней и заданий должно совпадать с его календарём.
 */

export const pad2 = (value: number) => String(value).padStart(2, "0");

export const formatLocalDate = (date: Date) => {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

export const getDailyCycleKey = (date = new Date()) => {
  return `daily-${formatLocalDate(date)}`;
};

export const getStartOfWeek = (date = new Date()) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  const day = result.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffFromMonday = day === 0 ? 6 : day - 1;

  result.setDate(result.getDate() - diffFromMonday);
  return result;
};

export const getWeeklyCycleKey = (date = new Date()) => {
  return `weekly-${formatLocalDate(getStartOfWeek(date))}`;
};

export const previousDayString = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  const parsed = new Date(year, (month || 1) - 1, date || 1);
  parsed.setDate(parsed.getDate() - 1);
  return formatLocalDate(parsed);
};

export const dateFromDailyCycleKey = (cycleKey: string) => {
  return cycleKey.startsWith("daily-") ? cycleKey.slice("daily-".length) : null;
};

// «2026-07-20» → локальная полночь. Через new Date(строка) нельзя: такая
// строка читается как UTC и западнее Гринвича съезжает на день назад.
export const parseLocalDate = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, (month || 1) - 1, date || 1);
};
