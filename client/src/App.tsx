/**
 * КОРЕНЬ ПРИЛОЖЕНИЯ — отсюда стоит начинать знакомство с кодом.
 *
 * ══ ЧТО ТУТ ПРОИСХОДИТ ══
 *
 * - четыре вкладки и переходы между ними (`Router` ниже + `bottom-nav.tsx`);
 * - опрос куратора: раз в `CLAIM_POLL_INTERVAL_MS` спрашиваем серверок,
 *   не подтвердил ли он отправленные задания;
 * - очередь всплывающих окон: вердикт куратора, повышение уровня, медаль,
 *   эволюция призрака. Они не должны наезжать друг на друга, поэтому
 *   показываются по очереди, а не разом.
 *
 * ══ КАРТА ПАПОК (что где искать) ══
 *
 * - `pages/`      — четыре экрана: питомец, задания, магазин, профиль;
 * - `components/` — куски экранов и полноэкранные окна;
 * - `lib/`        — НАСТРОЙКИ И ТЕКСТЫ. Почти всё, что хочется поменять
 *                   словами, лежит здесь, и у каждого файла есть шапка
 *                   с правилами правки;
 * - `game/`       — механики без разметки: уровни, серия, даты, гардероб,
 *                   облако Телеграма. Их можно проверять отдельно от экранов;
 * - `hooks/use-game-state.ts` — стор: всё, что приложение помнит про ученика;
 * - `components/ui/` — готовые кирпичи от библиотеки, их не трогаем.
 *
 * Вне `client/` лежат ещё две важные папки:
 * - `worker/` — серверок на Cloudflare, через него идут заявки куратору;
 * - `tools/`  — разовые скрипты для картинок (вырезание, сжатие в webp).
 *
 * ══ ТАБЛИЦА СЛОЁВ. КТО КОГО ПЕРЕКРЫВАЕТ ══
 *
 * Слой (`z-…`) решает, что окажется сверху, когда на экране два окна разом.
 * Держать эти три этажа и не смешивать:
 *
 * - `z-50`  — нижние вкладки и панель владельца: обычная мебель экрана;
 * - `z-60`  — ПОЛНОЭКРАННЫЕ ОКНА: игровая комната, мини-игра, зал славы,
 *             медали, инвентарь, «Наши движухи», обучающий тур;
 * - `z-70`  — приветствие и просмотр работы крупно (окно поверх окна);
 * - `z-80`  — ВЕСТИ И ПРАЗДНИКИ: плашка куратора (`claim-notice`),
 *             повышение уровня, медаль, эволюция призрака.
 *
 * ⚠️ ОДНОГО НОМЕРА СЛОЯ МАЛО — проверено замером, а не предположено.
 * Оболочка ниже (`fixed inset-0`) заводит в Chrome СВОЙ отсчёт слоёв, и всё,
 * что нарисовано внутри неё, соревнуется только между собой: хоть `z-999`
 * поставь, полноэкранное окно из портала всё равно ляжет сверху. Поэтому
 * вести и праздники тоже выводятся ПОРТАЛОМ в `document.body` — тогда
 * их номер слоя наконец начинает что-то значить.
 *
 * ⚠️ ПОЧЕМУ ВЕСТИ ВЫШЕ ВСЕГО — настоящий баг, пойманный владельцем 27.07:
 * «отправил задание на проверку и пошёл играть; в момент принятия просто
 * из ниоткуда появляется конфетти, и всё — непонятно, что задание принято».
 * Плашка стояла на `z-50`, то есть ПОД открытой игрой, и её никто не видел.
 * А конфетти рисуется отдельным холстом поверх всей страницы (так устроена
 * библиотека) — вот его и было видно. Решение куратора может прийти в любую
 * секунду и на любом экране, поэтому весть о нём обязана быть выше всего,
 * что открыто. То же и с медалью: её теперь дают прямо во время игры.
 *
 * ══ ОТСТУП СНИЗУ, О КОТОРЫЙ УЖЕ СПОТЫКАЛИСЬ ══
 *
 * `pb-[80px]` ниже — это МЕСТО ПОД НИЖНИЕ ВКЛАДКИ, отведённое один раз
 * на всё приложение. Внутри экранов его добавлять ещё раз НЕ надо:
 * так уже делали, отступ считался дважды, и главный экран переставал
 * помещаться в окно.
 */
import { Router as WouterRouter, Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { useGameState, type GameState } from "@/hooks/use-game-state";
import {
  CLAIM_POLL_INTERVAL_MS,
  syncPendingClaims,
} from "@/game/claims-sync";
import { ClaimNotice } from "@/components/claim-notice";
import {
  ACHIEVEMENTS_CONFIG,
  buildAchievementSnapshot,
  evaluateAchievements,
  type AchievementDefinition,
} from "@/lib/achievements-config";
import { AchievementUnlock } from "@/components/achievement-unlock";
import { PetEvolution, type PetEvolutionEvent } from "@/components/pet-evolution";
import { LevelUp } from "@/components/level-up";
import { getPetStage, getPreviousPetStage } from "@/lib/pet-config";
import { refreshTheme } from "@/lib/theme";

// Components & Pages
import { BottomNav } from "@/components/bottom-nav";
import PetPage from "@/pages/pet";
import QuestsPage from "@/pages/quests";
import ShopPage from "@/pages/shop";
import ProfilePage from "@/pages/profile";
import NotFound from "@/pages/not-found";
import { Tour } from "@/components/tour";
import { WelcomeGate } from "@/components/welcome-screen";

function Router() {
  // Тур живёт только на главной: все его шаги показывают то, что видно
  // отсюда, включая нижние вкладки. Он и монтируется вместе с ней —
  // поэтому «показать заново» из профиля срабатывает, как только ученик
  // вернётся на главный экран.
  const [location] = useLocation();

  return (
    <div className="relative w-full h-full pb-[80px]">
      <Switch>
        <Route path="/" component={PetPage} />
        <Route path="/quests" component={QuestsPage} />
        <Route path="/shop" component={ShopPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route component={NotFound} />
      </Switch>

      {/* Сначала ЗАЧЕМ (приветствие), потом ГДЕ (тур). Оба один раз
          и только на главной. Разбор, зачем понадобилось приветствие, —
          в шапке `lib/welcome-config.ts`. */}
      {location === "/" && (
        <WelcomeGate>
          <Tour />
        </WelcomeGate>
      )}
    </div>
  );
}

// Finds achievements the student unlocked but hasn't been shown yet.
function takeNewAchievements(state: GameState): AchievementDefinition[] {
  const unlockedIds = evaluateAchievements(buildAchievementSnapshot(state))
    .filter((entry) => entry.unlocked)
    .map((entry) => entry.definition.id);

  const unseen = unlockedIds.filter(
    (id) => !state.seenAchievements.includes(id)
  );

  if (unseen.length === 0) return [];

  state.markAchievementsSeen(unseen);

  return unseen
    .map((id) => ACHIEVEMENTS_CONFIG.find((def) => def.id === id))
    .filter((def): def is AchievementDefinition => Boolean(def));
}

function AppContent() {
  const bootstrapTelegramCloud = useGameState(
    (state) => state.bootstrapTelegramCloud
  );
  const level = useGameState((state) => state.level);
  const celebratedStages = useGameState((state) => state.celebratedStages);
  const markEvolutionSeen = useGameState((state) => state.markEvolutionSeen);
  const celebratedLevel = useGameState((state) => state.celebratedLevel);
  const markLevelUpSeen = useGameState((state) => state.markLevelUpSeen);
  const [achievementQueue, setAchievementQueue] = useState<
    AchievementDefinition[]
  >([]);

  // Превращение играем, если эту стадию ещё не праздновали. Сравнивать
  // «докуда дошли» одним числом нельзя: стоит поменять уровни стадий
  // в pet-config — и эволюция молча пропадает (так и случилось с «Учеником»).
  const currentStage = getPetStage(level);
  const previousStage = getPreviousPetStage(currentStage);
  const evolution: PetEvolutionEvent | null =
    previousStage && !celebratedStages.includes(currentStage.fromLevel)
      ? { from: previousStage, to: currentStage }
      : null;

  // Обычный уровень: показываем плашку, но не поверх эволюции.
  const levelUp = !evolution && level > celebratedLevel ? level : null;

  useEffect(() => {
    const enqueue = (state: GameState) => {
      const fresh = takeNewAchievements(state);
      if (fresh.length > 0) {
        setAchievementQueue((queue) => [...queue, ...fresh]);
      }
    };

    enqueue(useGameState.getState());

    return useGameState.subscribe((state) => {
      enqueue(state);
    });
  }, []);

  // Тема (светлая/тёмная): при первом входе — как в Telegram (вне Telegram —
  // как в системе), но ручной выбор в профиле важнее и запоминается.
  useEffect(() => {
    refreshTheme();

    // @ts-ignore
    window.Telegram?.WebApp?.onEvent?.("themeChanged", refreshTheme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener?.("change", refreshTheme);

    return () => {
      // @ts-ignore
      window.Telegram?.WebApp?.offEvent?.("themeChanged", refreshTheme);
      media.removeEventListener?.("change", refreshTheme);
    };
  }, []);

  useEffect(() => {
    try {
      // @ts-ignore
      if (window.Telegram?.WebApp) {
        // @ts-ignore
        window.Telegram.WebApp.ready();
        // @ts-ignore
        window.Telegram.WebApp.expand();
      }
    } catch (e) {
      console.warn("Telegram WebApp initialization failed", e);
    }

    void bootstrapTelegramCloud().then(() => {
      // A missed day may need patching by a streak freeze right at launch,
      // before the student even opens the quests tab.
      useGameState.getState().autoApplyStreakFreeze();

      // Решения, принятые пока приложение было закрыто, — сразу на старте.
      void syncPendingClaims();
    });
  }, [bootstrapTelegramCloud]);

  /**
   * Куратор опрашивается из САМОГО приложения, а не из вкладки заданий.
   *
   * Пока опрос жил на экране заданий, награда приходила только если ученик
   * там сидел, и сказать о ней было некому. Теперь ответ куратора догоняет
   * его где угодно — и о нём говорит плашка сверху.
   */
  useEffect(() => {
    const interval = window.setInterval(() => {
      void syncPendingClaims();
    }, CLAIM_POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <WouterRouter base="/Blender-Buddy-App">
      <div className="fixed inset-0 w-full h-full bg-background overflow-hidden">
        <div className="w-full h-full bg-background relative overflow-x-hidden overflow-y-auto flex flex-col">
          <Router />
          <BottomNav />
          <Toaster />
          <ClaimNotice />
          <PetEvolution
            evolution={evolution}
            onClaim={() => markEvolutionSeen(currentStage.fromLevel)}
          />
          <LevelUp level={levelUp} onDone={() => markLevelUpSeen(level)} />
          {/* Медали ждут своей очереди, пока играет эволюция */}
          <AchievementUnlock
            achievement={evolution ? null : achievementQueue[0] ?? null}
            remainingCount={Math.max(0, achievementQueue.length - 1)}
            onClaim={() => setAchievementQueue((queue) => queue.slice(1))}
          />
        </div>
      </div>
    </WouterRouter>
  );
}

function App() {
  return (
    <TooltipProvider>
      <AppContent />
    </TooltipProvider>
  );
}

export default App;
