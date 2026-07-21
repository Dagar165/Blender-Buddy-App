import { formatLocalDate, previousDayString } from "@/game/dates";

/**
 * Серия дней («огонёк») — вся арифметика в одном месте.
 *
 * День засчитывается, когда куратор одобрил задание, ОТПРАВЛЕННОЕ в этот день:
 * иначе долгая проверка сжигала бы серию не по вине ученика. Пропущенный день
 * может закрыть купленная заморозка.
 */

// Заявке на проверку достаточно этих полей — полный тип живёт в сторе.
type ClaimLike = {
  questType: "daily" | "weekly";
  cycleKey: string;
};

// Streak: a day counts once a daily quest SUBMITTED that day is approved.
// Crediting by submission date keeps curator review lag from burning streaks.
export const STREAK_BONUS_PER_DAY = 5;
export const STREAK_BONUS_CAP = 50;
const STREAK_DAYS_KEPT = 120;

export const chainLengthEndingAt = (coveredDays: Set<string>, day: string) => {
  let length = 0;
  let cursor = day;

  while (coveredDays.has(cursor)) {
    length += 1;
    cursor = previousDayString(cursor);
  }

  return length;
};

export const getStreakBonusPercent = (streak: number) => {
  return Math.min(STREAK_BONUS_CAP, Math.max(0, (streak - 1) * STREAK_BONUS_PER_DAY));
};

export const mergeStreakDays = (base: string[], extra: string[]) => {
  return Array.from(new Set([...base, ...extra])).sort().slice(-STREAK_DAYS_KEPT);
};

// A freeze can only patch YESTERDAY: it must reconnect a real chain (there was
// a streak the day before), and only when no pending claim already covers it —
// a claim awaiting review is not a missed day.
export const findFreezeGapDay = (
  confirmedDays: Set<string>,
  pendingDays: Set<string>
) => {
  const yesterday = previousDayString(formatLocalDate(new Date()));

  if (confirmedDays.has(yesterday) || pendingDays.has(yesterday)) return null;
  if (chainLengthEndingAt(confirmedDays, previousDayString(yesterday)) === 0) {
    return null;
  }

  return yesterday;
};

export const getPendingDailyDays = (pendingClaims: ClaimLike[]) => {
  const days = new Set<string>();

  for (const claim of pendingClaims) {
    if (claim.questType !== "daily") continue;
    const day = dateFromDailyCycleKey(claim.cycleKey);
    if (day) days.add(day);
  }

  return days;
};

// True the day after a freeze saved the streak — the UI can tell the student.
export const wasYesterdaySavedByFreeze = (frozenDays: string[]) => {
  return frozenDays.includes(previousDayString(formatLocalDate(new Date())));
};

export type StreakInfo = {
  current: number;
  todayCounted: boolean;
  atRisk: boolean;
  bonusPercent: number;
};

// Pending (not yet reviewed) daily claims light the flame right away; if the
// curator rejects them, the claim disappears and the day is uncovered again.
export const getStreakInfo = (
  streakDays: string[],
  pendingClaims: ClaimLike[],
  frozenDays: string[] = []
): StreakInfo => {
  const covered = new Set([...streakDays, ...frozenDays]);

  for (const claim of pendingClaims) {
    if (claim.questType !== "daily") continue;
    const day = dateFromDailyCycleKey(claim.cycleKey);
    if (day) covered.add(day);
  }

  const today = formatLocalDate(new Date());
  const todayCounted = covered.has(today);
  const current = todayCounted
    ? chainLengthEndingAt(covered, today)
    : chainLengthEndingAt(covered, previousDayString(today));

  return {
    current,
    todayCounted,
    atRisk: !todayCounted && current > 0,
    bonusPercent: getStreakBonusPercent(current),
  };
};
