import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Coins, RotateCcw } from "lucide-react";
import { useGameState } from "@/hooks/use-game-state";
import { getPetStage } from "@/lib/pet-config";
import { hapticSuccess, hapticWarn } from "@/lib/haptics";

/**
 * Плашка сверху: куратор посмотрел работу.
 *
 * Зачем: раньше решение куратора приходило молча — цифры наверху просто
 * менялись сами. Владелец: «резко начисляется и непонятно что». Теперь про это
 * говорят вслух, с призраком и суммой, на любой вкладке.
 *
 * Не блокирует экран: это не праздник уровня, а короткая весть. Уходит сама
 * через несколько секунд, но по нажатию исчезает сразу.
 */
const VISIBLE_MS = 5000;

export function ClaimNotice() {
  const notice = useGameState((state) => state.claimNotice);
  const clearClaimNotice = useGameState((state) => state.clearClaimNotice);
  const level = useGameState((state) => state.level);

  useEffect(() => {
    if (!notice) return;

    if (notice.tone === "approved") hapticSuccess();
    else hapticWarn();

    const timer = window.setTimeout(clearClaimNotice, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [notice, clearClaimNotice]);

  const approved = notice?.tone === "approved";
  const stage = getPetStage(level);

  return (
    <AnimatePresence>
      {notice && (
        <motion.button
          key={`${notice.tone}-${notice.title}-${notice.xp}`}
          onClick={clearClaimNotice}
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", bounce: 0.35, duration: 0.5 }}
          className={`fixed top-3 left-3 right-3 z-50 flex items-center gap-3 rounded-2xl border p-3 text-left shadow-xl backdrop-blur ${
            approved
              ? "bg-green-50/95 border-green-200 shadow-green-500/20 dark:bg-green-500/15 dark:border-green-500/40 dark:shadow-black/50"
              : "bg-amber-50/95 border-amber-200 shadow-amber-500/20 dark:bg-amber-500/15 dark:border-amber-500/40 dark:shadow-black/50"
          }`}
        >
          {/* Призрак, а не значок: весть приходит от него, он и радуется */}
          <span className="relative shrink-0">
            <img
              src={stage.image}
              alt=""
              className="w-12 h-12 object-contain select-none"
              draggable={false}
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-white shadow ${
                approved ? "bg-green-500" : "bg-amber-500"
              }`}
            >
              {approved ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : (
                <RotateCcw className="h-3 w-3" strokeWidth={3} />
              )}
            </span>
          </span>

          <span className="min-w-0 flex-1">
            <span
              className={`block font-display text-sm font-bold ${
                approved
                  ? "text-green-700 dark:text-green-200"
                  : "text-amber-700 dark:text-amber-200"
              }`}
            >
              {approved
                ? notice.count > 1
                  ? `Куратор принял задания (${notice.count})`
                  : "Задание принято!"
                : "Задание вернули на доработку"}
            </span>

            <span className="block truncate text-xs font-bold text-slate-500 dark:text-slate-400">
              {notice.count > 1 ? `«${notice.title}» и другие` : `«${notice.title}»`}
            </span>

            {approved ? (
              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold">
                <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-primary dark:bg-blue-500/15">
                  +{notice.xp} XP
                </span>
                <span className="flex items-center gap-1 rounded-lg bg-yellow-50 px-2 py-0.5 text-yellow-600 dark:bg-yellow-500/15 dark:text-yellow-400">
                  +{notice.gold} <Coins className="h-3 w-3" />
                </span>
                {notice.bonusPercent > 0 && (
                  <span className="rounded-lg bg-orange-50 px-2 py-0.5 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300">
                    серия +{notice.bonusPercent}%
                  </span>
                )}
                {notice.potionUsed && (
                  <span className="rounded-lg bg-purple-50 px-2 py-0.5 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300">
                    зелье ×2 🧪
                  </span>
                )}
              </span>
            ) : (
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                Поправь и отправь заново — задание снова в списке
              </span>
            )}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
