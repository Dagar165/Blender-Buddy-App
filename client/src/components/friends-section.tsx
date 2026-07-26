import { useState } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { GalleryPanel } from "@/components/gallery-panel";
import { MovementPanel } from "@/components/movement-panel";
import { HELPER_BOT, openOutboundLink } from "@/lib/links-config";
import { hapticTap } from "@/lib/haptics";

/**
 * «ДВИЖ» — третий экран главной. Всё, что связывает ребёнка с другими:
 * работы учеников, марафон с чатом школы и бот-помощник.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫМ ЭКРАНОМ (владелец 26.07). Раньше эти двери стояли
 * в профиле вперемешку с настройками темы и кнопкой сброса прогресса.
 * Профиль от этого стал «нагроможденным», а сами двери потерялись:
 * за залом славы надо идти туда же, куда за переключателем темы.
 *
 * Экраны с содержимым открываются ПО КНОПКЕ и сами не всплывают —
 * общее правило приложения: не уводить ребёнка от задания, ради которого
 * он пришёл. Оранжевыми кнопки не делаем, оранжевая в приложении одна
 * и всегда про задание.
 */
export function FriendsSection() {
  const [showGallery, setShowGallery] = useState(false);
  const [showMovement, setShowMovement] = useState(false);

  return (
    <div className="w-full max-w-sm mx-auto">
      <h2 className="font-display text-xl font-bold text-slate-800 dark:text-slate-100 mb-3">
        Движ
</h2>

      {/* Зал славы стоит первым: это работы таких же ребят, а не рассказ
          про школу, — и ради этого сюда возвращаются. */}
      <button
        onClick={() => {
          hapticTap();
          setShowGallery(true);
        }}
        className="w-full mb-3 p-4 rounded-3xl bg-white dark:bg-card border border-primary/30 dark:border-primary/30 shadow-sm flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
      >
        <span className="text-2xl leading-none shrink-0">🏆</span>
        <span className="flex-1 min-w-0">
          <span className="block font-display font-bold text-slate-800 dark:text-slate-100">
            Зал славы
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 leading-snug">
            Работы ребят из школы
          </span>
        </span>
        <ChevronRight className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600" />
      </button>

      <button
        onClick={() => {
          hapticTap();
          setShowMovement(true);
        }}
        className="w-full mb-3 p-4 rounded-3xl bg-white dark:bg-card border border-secondary/30 dark:border-secondary/30 shadow-sm flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
      >
        <span className="text-2xl leading-none shrink-0">🔨</span>
        <span className="flex-1 min-w-0">
          <span className="block font-display font-bold text-slate-800 dark:text-slate-100">
            Наши движухи
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 leading-snug">
            Марафон и чат школы — что это и чем отличается
          </span>
        </span>
        <ChevronRight className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600" />
      </button>

      {/* Полоски с превью работ тут БЫЛА И УБРАНА (владелец 27.07):
          «зачем нам тупо дублировать картинки детей на экране». Те же
          работы лежат за кнопкой «Зал славы» строкой выше — показывать
          их дважды на одном экране незачем. Не возвращать. */}

      <button
        onClick={() => openOutboundLink(HELPER_BOT)}
        className="w-full p-4 rounded-3xl bg-gradient-to-r from-primary to-blue-400 text-white shadow-lg shadow-primary/30 flex items-center gap-3 text-left active:scale-95 transition-transform"
      >
        <span className="text-2xl leading-none">{HELPER_BOT.emoji}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-display font-bold">
            {HELPER_BOT.title}
          </span>
          <span className="block text-xs text-blue-50/90 leading-snug">
            {HELPER_BOT.subtitle}
          </span>
        </span>
        <ExternalLink className="w-4 h-4 shrink-0 opacity-80" />
      </button>

      {showGallery && <GalleryPanel onClose={() => setShowGallery(false)} />}
      {showMovement && <MovementPanel onClose={() => setShowMovement(false)} />}
    </div>
  );
}
