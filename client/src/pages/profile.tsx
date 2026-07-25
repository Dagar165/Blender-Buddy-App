import { useGameState } from "@/hooks/use-game-state";
import { TopBar } from "@/components/top-bar";
import { motion } from "framer-motion";
import {
  User,
  RotateCcw,
  PenSquare,
  Sun,
  Moon,
  ExternalLink,
  SlidersHorizontal,
  ChevronRight,
  Compass,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { setTheme, useTheme } from "@/lib/theme";
import { DevPanel } from "@/components/dev-panel";
import { isDevUser } from "@/lib/dev-config";
import { SOCIAL_LINKS, openOutboundLink } from "@/lib/links-config";
import { hapticTap } from "@/lib/haptics";
import { getTelegramPhotoUrl } from "@/game/cloud";
import { forgetTour } from "@/components/tour";

/**
 * ПРОФИЛЬ — имя, тема, подсказки, наши каналы и сброс прогресса.
 *
 * ⚠️ ГЛАВНОЕ ПРО ЭТОТ ЭКРАН: он должен оставаться КОРОТКИМ И СКУЧНЫМ.
 *
 * 26.07 владелец назвал его «очень нагроможденным», и причина была не
 * в количестве блоков, а в том, что экран смешивал четыре разные вещи:
 * кто я, как я расту, куда сходить и настройки. Всё игровое отсюда
 * переехало на главную вторым и третьим экраном —
 * `components/growth-section.tsx` и `components/friends-section.tsx`.
 *
 * Сюда заходят редко и по делу. Новую игровую вещь класть НЕ СЮДА.
 */
export default function ProfilePage() {
  const {
    username,
    level,
    xp,
    gold,
    telegramUserId,
    telegramUsername,
    setUsername,
    resetGame,
  } = useGameState();
  const theme = useTheme();
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(username);
  const [showDevPanel, setShowDevPanel] = useState(false);

  // Аватарка спрашивается у Телеграма один раз за открытие экрана.
  const [photoUrl] = useState(getTelegramPhotoUrl);
  const [photoFailed, setPhotoFailed] = useState(false);
  const initial = username.trim().charAt(0).toUpperCase();

  // Кнопка панели видна только владельцу — список в lib/dev-config.ts.
  const canUseDevPanel = isDevUser(telegramUserId, telegramUsername);

  const handleSaveName = () => {
    if (editName.trim()) {
      setUsername(editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full bg-slate-50 dark:bg-background"
    >
      <TopBar />

      <div className="px-6 pb-24 overflow-y-auto">
        <div className="bg-white dark:bg-card rounded-3xl p-6 shadow-lg shadow-slate-200/50 dark:shadow-black/30 border border-transparent dark:border-border relative overflow-hidden mb-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -z-0" />

          <div className="flex items-center gap-4 relative z-10">
            {/* Лицо ученика, а не безликий значок. Телеграм отдаёт аватарку
                не всегда (настройки приватности, способ запуска), и ссылка
                со временем протухает — поэтому у картинки всегда есть запасной
                вариант, и он включается сам по ошибке загрузки. */}
            <div className="w-20 h-20 shrink-0 bg-gradient-to-tr from-primary to-blue-300 rounded-full flex items-center justify-center text-white shadow-md border-4 border-white dark:border-slate-700 overflow-hidden">
              {photoUrl && !photoFailed ? (
                <img
                  src={photoUrl}
                  alt=""
                  onError={() => setPhotoFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : initial ? (
                <span className="font-display text-3xl font-bold leading-none">
                  {initial}
                </span>
              ) : (
                <User className="w-10 h-10" />
              )}
            </div>

            <div className="flex-1">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-slate-100 dark:bg-muted border-none rounded-lg px-3 py-1 w-full text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-primary outline-none"
                    autoFocus
                    onBlur={handleSaveName}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-display font-bold text-slate-800 dark:text-slate-100 truncate">
                    {username}
                  </h2>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-slate-400 hover:text-primary transition-colors bg-slate-50 dark:bg-muted rounded-full"
                  >
                    <PenSquare className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-md text-xs">Уровень {level}</span>
                <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">{xp} Всего XP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Тема: ставится сама при первом входе, но выбор здесь важнее */}
        <div className="bg-white dark:bg-card rounded-3xl shadow-sm border border-slate-100 dark:border-border mb-6 px-5 py-4 flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Тема
          </span>

          <div className="ml-auto flex items-center gap-1 bg-slate-100 dark:bg-muted rounded-xl p-1">
            {([
              { value: "light" as const, label: "Светлая", icon: Sun },
              { value: "dark" as const, label: "Тёмная", icon: Moon },
            ]).map((option) => {
              const OptionIcon = option.icon;
              const isActive = theme === option.value;

              return (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                    isActive
                      ? "bg-white dark:bg-card text-slate-800 dark:text-slate-100 shadow-sm"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  <OptionIcon
                    className={`w-4 h-4 ${
                      isActive ? "text-secondary" : ""
                    }`}
                  />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Тур проходится один раз при первом запуске. Отсюда его можно
            позвать снова: он живёт на главном экране, поэтому сначала
            забываем отметку «уже видел», потом уводим туда. */}
        <button
          onClick={() => {
            hapticTap();
            forgetTour();
            setLocation("/");
          }}
          className="w-full mb-6 px-5 py-4 flex items-center gap-3 rounded-3xl bg-white dark:bg-card shadow-sm border border-slate-100 dark:border-border text-left active:scale-[0.99] transition-transform"
        >
          <Compass className="w-5 h-5 shrink-0 text-primary" />
          <span className="flex-1 text-sm font-medium text-slate-600 dark:text-slate-300">
            Показать подсказки заново
          </span>
          <ChevronRight className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600" />
        </button>

        {/* Статистика, достижения, инвентарь, зал славы, движухи и бот
            ПЕРЕЕХАЛИ ОТСЮДА на главный экран (26.07). Владелец назвал этот
            экран «очень нагроможденным», и был прав: он смешивал четыре
            разные вещи — кто я, как я расту, куда сходить и настройки.

            Осталось только последнее: имя, тема, подсказки, каналы и сброс.
            Сюда заходят редко и по делу, поэтому экран и должен быть
            коротким и скучным. Не возвращать сюда игровое —
            см. components/growth-section.tsx и components/friends-section.tsx. */}
        <div className="bg-white dark:bg-card rounded-3xl shadow-sm border border-slate-100 dark:border-border mb-8 overflow-hidden">
          {SOCIAL_LINKS.map((link, index) => (
            <button
              key={link.id}
              onClick={() => openOutboundLink(link)}
              className={`w-full flex items-center gap-3 px-5 py-3.5 text-left active:bg-slate-50 dark:active:bg-muted transition-colors ${
                index > 0 ? "border-t border-slate-100 dark:border-border" : ""
              }`}
            >
              <span className="text-xl leading-none">{link.emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-sm text-slate-700 dark:text-slate-200">
                  {link.title}
                </span>
                <span className="block text-xs text-slate-400 dark:text-slate-500">
                  {link.subtitle}
                </span>
              </span>
              <ExternalLink className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600" />
            </button>
          ))}
        </div>

        {canUseDevPanel && (
          <button
            onClick={() => setShowDevPanel(true)}
            className="w-full mb-3 py-4 flex items-center justify-center gap-2 text-violet-600 dark:text-violet-300 font-bold bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 rounded-2xl transition-colors"
          >
            <SlidersHorizontal className="w-5 h-5" /> Панель владельца
          </button>
        )}

        <button
          onClick={() => {
            if (window.confirm("Ты уверен, что хочешь сбросить весь свой прогресс?")) {
              resetGame();
            }
          }}
          className="w-full py-4 flex items-center justify-center gap-2 text-red-500 dark:text-red-400 font-bold bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-2xl transition-colors"
        >
          <RotateCcw className="w-5 h-5" /> Сбросить прогресс
        </button>
      </div>

      {showDevPanel && <DevPanel onClose={() => setShowDevPanel(false)} />}
    </motion.div>
  );
}
