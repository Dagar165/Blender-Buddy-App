import { useState } from "react";
import { ChevronDown, ChevronUp, GraduationCap, Play } from "lucide-react";
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
 *
 * СВОРАЧИВАЕТСЯ, а не закрывается (замечание владельца 23.07: раскрытая
 * плашка висела всё время и съедала пол-экрана над заданиями). Свёрнутая —
 * одна строка, нажал и раскрыл обратно. Насовсем не прячем: тот, кому уроки
 * нужнее всего, свернёт их машинально в первую же минуту, поэтому через
 * BEGINNER_COURSE.collapsedReopenHours они раскрываются сами.
 *
 * Состояние живёт в памяти устройства, а не в облаке: это не прогресс,
 * а «я уже видел», и тащить его между телефоном и ноутбуком незачем.
 */

const STORAGE_KEY = "bb_beginner_hint_v1";
const HOUR_MS = 60 * 60 * 1000;

function readCollapsedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const value = raw ? Number(raw) : NaN;

    return Number.isFinite(value) ? value : null;
  } catch {
    // Приватный режим или запрет на хранилище — тогда просто всегда раскрыта.
    return null;
  }
}

function writeCollapsedAt(value: number | null) {
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Не записалось — не беда, поведение просто вернётся к «раскрыта».
  }
}

function isCollapsedNow(): boolean {
  const collapsedAt = readCollapsedAt();

  if (collapsedAt === null) return false;

  const hours = BEGINNER_COURSE.collapsedReopenHours;

  // 0 часов — свернули насовсем, обратно сама не вылезет.
  if (hours <= 0) return true;

  return Date.now() - collapsedAt < hours * HOUR_MS;
}

export function BeginnerHint({ level }: { level: number }) {
  // Считаем один раз при открытии экрана: если пересчитывать на каждый
  // рендер, плашка раскроется прямо под пальцем ровно в момент истечения срока.
  const [collapsed, setCollapsed] = useState(isCollapsedNow);

  if (level > BEGINNER_COURSE.showUpToLevel) return null;

  const toggle = () => {
    hapticTap();

    setCollapsed((wasCollapsed) => {
      writeCollapsedAt(wasCollapsed ? null : Date.now());
      return !wasCollapsed;
    });
  };

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

  // Свёрнутая: одна строка вместо блока в пол-экрана.
  if (collapsed) {
    return (
      <button
        onClick={toggle}
        className="flex w-full items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50/70 px-3 py-2 text-left transition-transform active:scale-[0.99] dark:border-sky-500/30 dark:bg-sky-500/10"
      >
        <GraduationCap className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-600 dark:text-slate-300">
          {BEGINNER_COURSE.shortTitle}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-500/30 dark:bg-sky-500/10">
      <div className="flex items-start gap-2">
        <p className="flex min-w-0 flex-1 items-center gap-2 font-display text-sm font-bold text-slate-800 dark:text-slate-100">
          <GraduationCap className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />
          {BEGINNER_COURSE.title}
        </p>

        {/* Свернуть, а не закрыть: дверь остаётся видна, просто узкой полоской */}
        <button
          onClick={toggle}
          aria-label="Свернуть"
          className="-mr-1 -mt-1 shrink-0 rounded-lg p-1 text-sky-600 transition-transform active:scale-90 dark:text-sky-300"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>

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
