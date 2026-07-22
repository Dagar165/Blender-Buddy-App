import { GraduationCap, Play } from "lucide-react";
import { BEGINNER_COURSE } from "@/lib/learn-config";
import { openOutboundLink } from "@/lib/links-config";
import { hapticTap } from "@/lib/haptics";

/**
 * Дверь к урокам с нуля. Видна только новичку (см. showUpToLevel).
 *
 * Стоит НАД заданиями нарочно: ребёнок, который не умеет ничего, должен
 * упереться в неё раньше, чем в «собери меч из кубов». Но кнопка синяя
 * и спокойная — задание всё равно остаётся главным делом экрана, а это
 * запасной вход для тех, кому оно пока не по зубам.
 */
export function BeginnerHint({ level }: { level: number }) {
  if (level > BEGINNER_COURSE.showUpToLevel) return null;

  const open = (url: string) => {
    hapticTap();
    openOutboundLink({
      id: "beginner",
      title: BEGINNER_COURSE.title,
      subtitle: "",
      url,
      // YouTube — внешний браузер, ВК-видео тоже: внутри Телеграма они
      // открываются криво или не открываются вовсе.
      kind: "web",
      emoji: "🎬",
    });
  };

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-500/30 dark:bg-sky-500/10">
      <p className="flex items-center gap-2 font-display text-sm font-bold text-slate-800 dark:text-slate-100">
        <GraduationCap className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />
        {BEGINNER_COURSE.title}
      </p>

      <p className="mt-1 text-xs leading-snug text-slate-600 dark:text-slate-300">
        {BEGINNER_COURSE.text}
      </p>

      {/* Две двери: у кого не грузится одна — уходит во вторую,
          а не остаётся ни с чем */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => open(BEGINNER_COURSE.youtube)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-bold text-sky-700 transition-transform active:scale-95 dark:border-sky-500/40 dark:bg-card dark:text-sky-300"
        >
          <Play className="h-3.5 w-3.5" />
          YouTube
        </button>
        <button
          onClick={() => open(BEGINNER_COURSE.vk)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-bold text-sky-700 transition-transform active:scale-95 dark:border-sky-500/40 dark:bg-card dark:text-sky-300"
        >
          <Play className="h-3.5 w-3.5" />
          ВКонтакте
        </button>
      </div>
    </div>
  );
}
