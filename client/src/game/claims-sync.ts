import { fetchClaimStatuses } from "@/lib/quest-claim";
import { useGameState } from "@/hooks/use-game-state";

/**
 * Опрос куратора: не решил ли он что-нибудь по отправленным заявкам.
 *
 * Живёт отдельно от экранов НАРОЧНО. Раньше опрос крутился только на вкладке
 * заданий, поэтому награда «прилетала» лишь когда ученик туда заходил, а плашку
 * о ней показать было неоткуда. Теперь спрашивает само приложение, а весть
 * о решении кладётся в стор (claimNotice) — её показывает верхняя плашка,
 * на какой бы вкладке ученик ни сидел.
 *
 * ВАЖНО: опрашивающий должен быть ОДИН. Два одновременных запроса могут
 * получить одно и то же «одобрено» и начислить награду дважды — поэтому здесь
 * замок: пока предыдущий заход не кончился, новый просто ждёт его.
 */
export const CLAIM_POLL_INTERVAL_MS = 20_000;

let inFlight: Promise<void> | null = null;

async function runSync(): Promise<void> {
  const { pendingClaims } = useGameState.getState();
  if (pendingClaims.length === 0) return;

  const statuses = await fetchClaimStatuses(
    pendingClaims.map((claim) => claim.claimId)
  );
  if (!statuses) return;

  // Состояние берём заново: пока ходили в сеть, оно могло измениться.
  useGameState.getState().applyClaimResolutions(statuses);
}

export function syncPendingClaims(): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = runSync().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
