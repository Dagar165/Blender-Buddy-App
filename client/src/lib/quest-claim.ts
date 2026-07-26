/**
 * СВЯЗЬ С СЕРВЕРКОМ ПРОВЕРКИ. Тут вся дорога от «Выполнил» до награды.
 *
 * Две задачи: отправить заявку куратору и потом спросить, что он решил.
 * Сам серверок лежит в папке `worker/` (Cloudflare Worker), туда же
 * приходит нажатие куратора «Подтвердить» из Телеграма.
 *
 * ⚠️ **Награду даёт НЕ этот файл и не экран заданий.** Здесь только
 * переписка. Опыт и голда начисляются в сторе, когда пришёл ответ
 * «подтверждено» (`applyClaimResolutions` в `hooks/use-game-state.ts`).
 * Начислить раньше — значит выдать награду за непроверенную работу.
 *
 * Ошибки отправки НЕ проглатываются: экран обязан показать, что заявка
 * не ушла, иначе ребёнок будет ждать ответа, которого никто не получал.
 *
 * `WORKER_URL` — адрес серверка. Меняется только вместе с его выкладкой.
 */

const WORKER_URL = "https://jkids-quest-check.sergfenchen.workers.dev";

export type ClaimStatus = "pending" | "approved" | "rejected" | "unknown";

export type QuestClaimInput = {
  questId: string;
  questTitle: string;
  questType: "daily" | "weekly";
  cycleKey: string;
  xpReward: number;
  goldReward: number;
  username: string;
  telegramUsername: string | null;
  telegramUserId: number | null;
};

export type SubmitClaimResult =
  | { ok: true; claimId: string; status: ClaimStatus }
  | { ok: false; error: string };

export async function submitQuestClaim(
  claim: QuestClaimInput
): Promise<SubmitClaimResult> {
  try {
    const res = await fetch(`${WORKER_URL}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(claim),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok || !data?.claimId) {
      return { ok: false, error: data?.error || `http_${res.status}` };
    }

    return { ok: true, claimId: data.claimId, status: data.status };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function fetchClaimStatuses(
  claimIds: string[]
): Promise<Record<string, ClaimStatus> | null> {
  if (claimIds.length === 0) return {};

  try {
    const res = await fetch(
      `${WORKER_URL}/claims?ids=${claimIds.join(",")}`
    );
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok || !data?.statuses) {
      return null;
    }

    return data.statuses as Record<string, ClaimStatus>;
  } catch {
    return null;
  }
}
