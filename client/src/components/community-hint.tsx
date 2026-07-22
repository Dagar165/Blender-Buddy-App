import { ArrowRight } from "lucide-react";
import { COMMUNITY_LINK } from "@/lib/community-config";
import { openOutboundLink } from "@/lib/links-config";
import { hapticTap } from "@/lib/haptics";

/**
 * Упоминание движухи: фраза призрака и дверь, в которую можно войти.
 *
 * Нарочно НЕ оранжевая и не громкая. Оранжевая кнопка на экране одна, и это
 * всегда «сделай задание» — если приглашение в чат станет ярче дела, бот
 * начнёт уводить ребёнка от работы, ради которой он здесь.
 *
 * Пусто пришло — ничего не рисуем: так фразу можно выключить, просто удалив
 * её из community-config, и ни одно место не сломается.
 */
export function CommunityHint({
  line,
  className = "",
}: {
  line: string | null;
  className?: string;
}) {
  if (!line) return null;

  return (
    <button
      onClick={() => {
        hapticTap();
        openOutboundLink(COMMUNITY_LINK);
      }}
      className={`w-full rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-left transition-transform active:scale-[0.98] dark:border-sky-500/30 dark:bg-sky-500/10 ${className}`}
    >
      <span className="block text-xs leading-snug text-slate-600 dark:text-slate-300">
        {line}
      </span>
      <span className="mt-1.5 flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-300">
        Открыть чат школы
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}
