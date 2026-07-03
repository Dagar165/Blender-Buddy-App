// Talks to the verification worker: files quest-completion claims and polls
// their statuses. Rewards are granted only after the curator approves a claim,
// so submission failures surface to the caller instead of being swallowed.

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
