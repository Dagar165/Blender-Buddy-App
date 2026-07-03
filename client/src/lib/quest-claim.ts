// Sends a quest-completion claim to the verification worker, which notifies
// the curator in Telegram. Fire-and-forget: a network failure here must never
// block the in-app reward flow, so callers should not await-throw on it.

const WORKER_URL = "https://jkids-quest-check.sergfenchen.workers.dev";

export type QuestClaim = {
  questId: string;
  questTitle: string;
  questType: "daily" | "weekly";
  xpReward: number;
  goldReward: number;
  username: string;
  telegramUsername: string | null;
  telegramUserId: number | null;
};

export async function submitQuestClaim(claim: QuestClaim): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(claim),
    });
  } catch (err) {
    // Offline or worker unreachable — the reward already showed locally.
    console.warn("Quest claim not delivered:", err);
  }
}
