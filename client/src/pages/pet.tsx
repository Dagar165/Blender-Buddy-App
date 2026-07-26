import { useEffect, useMemo, useRef, useState } from "react";
import { useGameState } from "@/hooks/use-game-state";
import { getStreakInfo } from "@/game/streak";
import { TopBar } from "@/components/top-bar";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { hapticSelect, hapticTap } from "@/lib/haptics";
import { Link } from "wouter";
import { CheckCircle, ChevronDown, ChevronRight, Clock, Scroll } from "lucide-react";
import { getActiveQuestsForTab } from "@/lib/quests-rotation";
import { CarePanel } from "@/components/care-panel";
import { RoomCubes } from "@/components/room-cubes";
import { GrowthSection } from "@/components/growth-section";
import { FriendsSection } from "@/components/friends-section";
import { ScreenDots } from "@/components/screen-dots";
import {
  CARE_NEEDS,
  getCarePhrase,
  getNeedLevel,
  type CareNeedId,
} from "@/lib/care-config";
import {
  PET_PHRASES,
  RETURN_AFTER_DAYS,
  RETURN_PHRASES,
  PET_STAGES,
  getNextPetStage,
  getPetStage,
  type PetMood,
} from "@/lib/pet-config";
import { Ghost } from "@/components/ghost";
import { SHOP_ITEMS, getClothingSlot } from "@/lib/shop-config";
import { getWornOverlays, isItemWorn } from "@/game/wardrobe";
import { TIP_VISIBLE_MS } from "@/lib/tips-config";
import {
  BUBBLE_EVERY,
  BUBBLE_LINES,
  COMMUNITY_LINK,
  pickCommunityLine,
} from "@/lib/community-config";
import { openOutboundLink } from "@/lib/links-config";

const getPetMood = (input: {
  todayCounted: boolean;
  atRisk: boolean;
  potionActive: boolean;
}): PetMood => {
  if (input.atRisk) return "worried";
  if (input.potionActive) return "potion";
  if (input.todayCounted) return "happy";
  return "idle";
};

// Slower, lower float when the ghost is worried — body language matters.
const MOOD_ANIMATION: Record<PetMood, { y: number[]; duration: number }> = {
  happy: { y: [0, -14, 0], duration: 2.4 },
  potion: { y: [0, -12, 0], duration: 2.8 },
  idle: { y: [0, -10, 0], duration: 3.2 },
  worried: { y: [0, -5, 0], duration: 4 },
};

// Плавающее сердечко после поглаживания
type Heart = { id: number; x: number; withXp: boolean };

/**
 * Номер захода на главный экран — от него зависит, что призрак скажет.
 *
 * Раньше фраза выбиралась по текущей МИНУТЕ: уйдёшь на другую вкладку,
 * вернёшься через десять секунд — тот же текст. Владелец так и сказал:
 * «не понимаю, от чего это зависит». Теперь счётчик, а не часы: каждый заход
 * берёт следующую фразу по кругу, повторов подряд не бывает.
 *
 * Начинается со случайного места, а не с нуля. Со счёта «1» каждый запуск
 * приложения открывался ОДНОЙ И ТОЙ ЖЕ фразой — владелец закрыл и открыл
 * приложение дважды и оба раза увидел «Blender там пылится».
 */
let visitNumber = Math.floor(Math.random() * 1000);

/**
 * Подсказка «как трогать призрака» уходит навсегда после трёх поглаживаний.
 *
 * Счёт живёт в памяти УСТРОЙСТВА, а не в сторе. Причина важная: в сторе есть
 * похожее поле `petTapsTotal`, и первая версия считала по нему — оказалось
 * неверно. **`petTapsTotal` — это «сколько погладил С ПРОШЛОГО СОВЕТА»,
 * и он обнуляется каждый раз, когда призрак выдаёт совет по Blender.**
 * Поэтому подсказка возвращалась после каждого совета, снова и снова.
 * Не использовать `petTapsTotal` в смысле «уже разобрался».
 */
const PETTING_HINT_TAPS = 3;
const PETTING_HINT_KEY = "bb_pet_hint_v1";

function readPettingTaps(): number {
  try {
    return Number(window.localStorage.getItem(PETTING_HINT_KEY)) || 0;
  } catch {
    // Нет доступа к памяти — подсказка просто останется видимой.
    return 0;
  }
}

function writePettingTaps(value: number) {
  try {
    window.localStorage.setItem(PETTING_HINT_KEY, String(value));
  } catch {
    // Не записалось — не страшно, подсказка ещё повисит.
  }
}

// Гизмо осей из угла 3D-окна Blender. Отсылка — но нажимаемая: под ней
// прячется маленький урок про X, Y и Z, который пригодится в самом Blender.
function AxisGizmo() {
  return (
    <svg
      className="opacity-90 pointer-events-none"
      width="40"
      height="40"
      viewBox="0 0 46 46"
    >
      <circle cx="23" cy="23" r="22" className="fill-white/80 dark:fill-slate-900/60" />
      <line x1="23" y1="23" x2="38" y2="29" stroke="#e3402e" strokeWidth="1.7" />
      <line x1="23" y1="23" x2="10" y2="30" stroke="#6fa21c" strokeWidth="1.7" />
      <line x1="23" y1="23" x2="23" y2="7" stroke="#3b83bd" strokeWidth="1.7" />
      <circle cx="38" cy="29" r="4.4" fill="#e3402e" />
      <circle cx="10" cy="30" r="4.4" fill="#6fa21c" />
      <circle cx="23" cy="7" r="4.4" fill="#3b83bd" />
    </svg>
  );
}

export default function PetPage() {
  const {
    level,
    inventory,
    equipped,
    streakDays,
    frozenDays,
    pendingClaims,
    dailyProgress,
    weeklyProgress,
    potionActive,
    care,
    petGhost,
    markVisit,
    wearItem,
    takeOffItem,
  } = useGameState();

  // Считается один раз на заход: страница пересоздаётся при каждом
  // переключении вкладок, значит и фраза будет новой.
  const [visit] = useState(() => ++visitNumber);

  const [hearts, setHearts] = useState<Heart[]>([]);
  // Подсказки в комнате: что за ступень пути и что за оси в углу.
  const [hint, setHint] = useState<"stage" | "axes" | null>(null);
  // Совет по Blender вытесняет обычную фразу на несколько секунд.
  const [tip, setTip] = useState<string | null>(null);
  // Встреча после паузы — показывается один раз за визит.
  const [greeting, setGreeting] = useState<string | null>(null);
  // Сколько раз погладили за всё время — только ради подсказки.
  const [pettingTaps, setPettingTaps] = useState(readPettingTaps);

  useEffect(() => {
    const daysAway = markVisit();

    if (daysAway >= RETURN_AFTER_DAYS) {
      setGreeting(
        RETURN_PHRASES[Math.floor(Math.random() * RETURN_PHRASES.length)]
      );
    }
  }, [markVisit]);

  // Призрака можно крутить пальцем. Тестировщик: «отчаянно хочется покрутить
  // персонажа, интерфейс блендера располагает». Тянем — поворачивается и
  // наклоняется, отпускаем — пружинит обратно. Заодно это и есть тот самый
  // отклик, которого не хватало: приложение слушается пальца.
  const swing = useMotionValue(0);
  const rotateY = useTransform(swing, [-140, 140], [-26, 26]);
  const tilt = useTransform(swing, [-140, 140], [7, -7]);
  // Чтобы бросок пальцем не засчитался как поглаживание.
  const draggingRef = useRef(false);

  // Прокрутка трёх экранов. Нужна точкам-указателям справа: по ней они
  // понимают, на каком экране мы сейчас, и умеют перескакивать.
  const screensRef = useRef<HTMLDivElement>(null);

  /**
   * Таймер, который убирает совет из пузыря. Держим его в руке НАРОЧНО.
   *
   * Тут была настоящая поломка (владелец 25.07: «невозможно остановиться
   * в нужный момент, следующее нажатие в случайных случаях сбрасывает всё»).
   * Таймер заводился на каждый совет и никогда не отменялся, а совет живёт
   * TIP_VISIBLE_MS = 7 секунд. Ребёнок гладит призрака часто, следующий совет
   * выпадает через 20–30 нажатий — при быстром тапанье это те же 6–8 секунд.
   * Значит новый совет успевал появиться ДО того, как срабатывал таймер
   * от прошлого, — и старый таймер гасил новый совет через секунду после
   * его появления. Отсюда и «в случайных случаях»: промежуток между советами
   * каждый раз разный.
   *
   * Правило: таймер, который что-то прячет, всегда отменяй перед тем,
   * как показать это заново.
   */
  const tipTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tipTimerRef.current !== null) {
        window.clearTimeout(tipTimerRef.current);
      }
    };
  }, []);

  const openHint = (which: "stage" | "axes") => {
    hapticTap();
    setHint((current) => (current === which ? null : which));
  };

  const handlePet = () => {
    if (draggingRef.current) return;

    hapticTap();

    // Считаем поглаживания для подсказки отдельно: см. PETTING_HINT_TAPS.
    if (pettingTaps < PETTING_HINT_TAPS) {
      const next = pettingTaps + 1;
      writePettingTaps(next);
      setPettingTaps(next);
    }

    const { granted, tip: freshTip } = petGhost();
    const id = Date.now() + Math.random();

    if (freshTip) {
      setGreeting(null);
      setTip(freshTip);

      // Гасим таймер прошлого совета, иначе он снимет этот раньше срока.
      if (tipTimerRef.current !== null) {
        window.clearTimeout(tipTimerRef.current);
      }

      tipTimerRef.current = window.setTimeout(() => {
        tipTimerRef.current = null;
        setTip(null);
      }, TIP_VISIBLE_MS);
    }

    setHearts((current) => [
      ...current.slice(-5),
      { id, x: Math.round(Math.random() * 80 - 40), withXp: granted },
    ]);

    window.setTimeout(() => {
      setHearts((current) => current.filter((heart) => heart.id !== id));
    }, 1100);
  };

  const streak = getStreakInfo(streakDays, pendingClaims, frozenDays);
  const mood = getPetMood({
    todayCounted: streak.todayCounted,
    atRisk: streak.atRisk,
    potionActive,
  });

  const moodPhrase = useMemo(() => {
    const phrases = PET_PHRASES[mood];
    return phrases[visit % phrases.length];
  }, [mood, visit]);

  // Как призрак себя чувствует: считается от времени последнего ухода.
  const careLevels = useMemo(() => {
    const levels = {} as Record<CareNeedId, number>;

    for (const need of CARE_NEEDS) {
      levels[need.id] = getNeedLevel(care[need.id] ?? null, need.decayHours);
    }

    return levels;
  }, [care]);

  const carePhrase = useMemo(
    () => getCarePhrase(careLevels, visit),
    [careLevels, visit]
  );

  /**
   * Изредка призрак вспоминает про двор — чат, разборы, голосование.
   *
   * Раз в BUBBLE_EVERY заходов, не чаще: это единственное упоминание движухи
   * в рутине, остальные стоят на пиках. Native жив на контрасте — если
   * призрак начнёт звать в чат через раз, ему перестанут верить и здесь,
   * и в остальном.
   */
  const communityLine = useMemo(
    () =>
      visit > 0 && visit % BUBBLE_EVERY === 0
        ? pickCommunityLine(BUBBLE_LINES, visit / BUBBLE_EVERY)
        : null,
    [visit]
  );

  // Что призрак говорит прямо сейчас. Порядок важен: свежий совет по Blender
  // важнее всего, потом встреча после паузы, потом просьба поесть или
  // прибраться, и только потом дежурная фраза настроения.
  //
  // Про двор стоит ВЫШЕ просьбы об уходе нарочно: просьба находится почти
  // всегда, и упоминание, поставленное ниже, не показалось бы никогда.
  // Оно и так выпадает раз в восемнадцать заходов.
  const phrase = tip ?? greeting ?? communityLine ?? carePhrase ?? moodPhrase;

  // Позвал в чат — дай дверь. Фраза без входа остаётся пустым звуком.
  const showCommunityDoor = Boolean(communityLine) && phrase === communityLine;

  const stage = getPetStage(level);
  const nextStage = getNextPetStage(level);
  const stageNumber = PET_STAGES.indexOf(stage) + 1;
  const animation = MOOD_ANIMATION[mood];

  const ownedItems = SHOP_ITEMS.filter((item) =>
    inventory.includes(item.name)
  );

  // Картинки надетых вещей: в порядке слоёв и с поправкой размера под стадию.
  const wornOverlays = useMemo(
    () => getWornOverlays(equipped, stage),
    [equipped, stage]
  );

  // Что делать прямо сейчас. Тестировщики говорили: «непонятно, куда тыкать
  // с первого взгляда» — главный экран красивый, но немой. Одна строка-кнопка
  // отвечает на этот вопрос и уводит туда, где происходит дело.
  const todo = useMemo(() => {
    const pendingDailyIds = pendingClaims
      .filter((claim) => claim.questType === "daily")
      .map((claim) => claim.questId);

    const quests = getActiveQuestsForTab(
      "daily",
      dailyProgress.cycleKey,
      weeklyProgress.cycleKey,
      weeklyProgress.weekDoneIds ?? [],
      pendingDailyIds
    );

    const waiting = quests.filter((quest) => {
      if (dailyProgress.completedIds.includes(quest.id)) return false;

      return !pendingClaims.some(
        (claim) =>
          claim.questId === quest.id &&
          claim.questType === "daily" &&
          claim.cycleKey === dailyProgress.cycleKey
      );
    });

    if (waiting.length > 0) {
      return {
        tone: "action" as const,
        text:
          waiting.length === 1
            ? `Осталось задание: ${waiting[0].title}`
            : `Сегодня ${waiting.length} задания — начни с первого`,
      };
    }

    const onReview = quests.some((quest) =>
      pendingClaims.some(
        (claim) =>
          claim.questId === quest.id && claim.cycleKey === dailyProgress.cycleKey
      )
    );

    return onReview
      ? { tone: "waiting" as const, text: "Куратор проверяет — награда придёт" }
      : { tone: "done" as const, text: "Задания дня сделаны. Красавчик!" };
  }, [
    dailyProgress.cycleKey,
    dailyProgress.completedIds,
    weeklyProgress.cycleKey,
    weeklyProgress.weekDoneIds,
    pendingClaims,
  ]);

  // Полоса опыта и подписи к ней переехали на второй экран,
  // в `components/growth-section.tsx` — там же и считаются.

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full bg-gradient-to-b from-blue-50 via-white to-blue-50/30 dark:from-[#101a2e] dark:via-[#0b1220] dark:to-[#0d1526]"
    >
      <TopBar />

      {/**
       * ГЛАВНАЯ — ТРИ ЭКРАНА, КОТОРЫЕ ПЕРЕКЛЮЧАЮТСЯ СВАЙПОМ.
       *
       * Задача владельца 26.07: «главный экран очень короткий — свайпнёшь
       * вверх, и там чуть-чуть только строка опыта», а профиль наоборот
       * «очень нагроможденный». Образец он показал сам — приложение, где
       * экран не листается бесконечно, а «движение пальцем сделал —
       * и переключился на второй».
       *
       * Так это и сделано: `snap-y snap-mandatory` на прокрутке и
       * `snap-start` на каждом экране. Браузер сам доводит до края
       * ближайшего экрана, промежуточных положений не остаётся.
       *
       * Каждый экран ровно в высоту окна (`min-h-full`), поэтому их ровно
       * три и на любом телефоне их будет три.
       *
       * ⚠️ Отступ снизу тут МАЛЕНЬКИЙ (`pb-4`), и это не забывчивость.
       * Место под нижние вкладки уже отведено выше, в оболочке приложения
       * (`App.tsx`, `pb-[80px]`). Пока тут стоял привычный `pb-24`, отступ
       * считался ДВАЖДЫ — экран призрака вырастал на сто точек и переставал
       * помещаться в окно. Не возвращать.
       *
       * Осторожно: если содержимое экрана станет выше окна (например,
       * раскрыли все медали), прилипание для него само отключится —
       * так устроен браузер, и это правильно. Ломаться ничего не будет,
       * но проверять новые блоки надо на 393×700.
       */}
      <div className="relative flex-1 min-h-0">
      <ScreenDots
        scrollRef={screensRef}
        count={3}
        labels={["Призрак", "Мой рост", "Ребята"]}
      />
      <div ref={screensRef} className="h-full overflow-y-auto snap-y snap-mandatory">
        {/**
         * ЭКРАН 1 — ПРИЗРАК. Всё, ради чего сюда заходят каждый день.
         *
         * Расстояния между блоками задаёт КОЛОНКА (gap-4), а не сами блоки.
         *
         * Раньше каждый блок нёс собственный отступ сверху, и это ломалось
         * при первой же правке: удалили строку «Стадия N из 5» — и вещи
         * гардероба прилипли к оранжевой кнопке. У того, кто ещё ничего
         * не купил, к ней так же прилипала полоса опыта: гардероба нет,
         * а его отступ и держал промежуток.
         *
         * С общим шагом любой блок можно убрать, скрыть или переставить —
         * расстояния останутся ровными. НЕ возвращать отступы внутрь блоков.
         */}
        {/**
         * ⚠️ ПРИЗРАК НА ЭТОМ ЭКРАНЕ НЕ УМЕНЬШАЕТСЯ. НИКОГДА.
         *
         * Прямое требование владельца 26.07, после того как первая версия
         * сделала комнату резиновой: «капец, этот экран больше принадлежит
         * не ему», «если появляется длинное сообщение в облаке, призрак
         * становится ещё меньше — это фатальная ошибка, такого быть
         * не должно». Сколько места картинка призрака занимала раньше,
         * столько и должна занимать в любом случае.
         *
         * Отсюда устройство экрана: у призрака ЖЁСТКИЙ размер, и он ни
         * от чего не зависит — ни от длины реплики, ни от высоты телефона.
         * Растягивается облако с репликой, а не он.
         *
         * Плата за это: на невысоком телефоне экран может оказаться чуть
         * выше окна, и первый свайп сначала доскроллит остаток. Так и надо:
         * крупный призрак важнее идеального прилипания. НЕ «чинить» это,
         * снова сделав призрака резиновым.
         */}
        <section className="relative snap-start min-h-full px-5 pb-9 flex flex-col items-center justify-center gap-2">
          {/* Комната призрака — отсылка к 3D-окну Blender:
              сетка пола, гизмо осей, а призрак «выделен» оранжевым */}
          <div
            data-tour="pet-room"
            className="relative w-full max-w-sm rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-700/60 bg-gradient-to-b from-sky-100 via-blue-50 to-slate-100 dark:from-[#1c2a44] dark:via-[#15203a] dark:to-[#101a30] shadow-xl shadow-primary/10"
          >
            {/* Каркасные кубики на фоне — как на лендинге школы. Стоят
                ПЕРВЫМИ в разметке, поэтому рисуются под всем остальным
                и призрак остаётся главным. */}
            <RoomCubes />

            {/* Угол HUD, как в Blender: имя активного объекта.
                Нажимается — объясняет, что это за ступень пути */}
            <button
              onClick={() => openHint("stage")}
              className={`absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-white/85 dark:bg-slate-900/70 border rounded-full px-2.5 py-1 text-[10px] font-bold text-orange-600 dark:text-orange-300 select-none transition-transform active:scale-95 ${
                hint === "stage"
                  ? "border-orange-400 dark:border-orange-400"
                  : "border-orange-200 dark:border-orange-500/40"
              }`}
            >
              <span className="w-2 h-2 rounded-[3px] bg-orange-500 shrink-0" />
              {stage.name}
            </button>

            <button
              onClick={() => openHint("axes")}
              className="absolute top-2.5 right-2.5 z-20 rounded-full transition-transform active:scale-95"
              aria-label="Что это за оси"
            >
              <AxisGizmo />
            </button>

            {/* Пол-сетка в перспективе */}
            <div
              className="absolute -left-1/3 -right-1/3 -bottom-2 h-[44%] pointer-events-none"
              style={{
                background:
                  "repeating-linear-gradient(90deg, rgba(59,130,246,.14) 0 1.5px, transparent 1.5px 46px), repeating-linear-gradient(0deg, rgba(59,130,246,.10) 0 1.5px, transparent 1.5px 30px)",
                transform: "perspective(340px) rotateX(58deg)",
                transformOrigin: "50% 100%",
              }}
            />

            {/**
             * ⚠️ ВЕРХНИЙ ОТСТУП ЗДЕСЬ — ЭТО ЗАБРОНИРОВАННОЕ МЕСТО ПОД ОБЛАКО.
             *
             * Облако с репликой лежит ПОВЕРХ (absolute), а не в потоке —
             * и это принципиально. Пока оно стояло в потоке, оно толкало
             * призрака вниз и растягивало комнату от каждой длинной фразы:
             * экран переставал влезать в окно, а подсказка «Листай вверх»
             * наезжала на оранжевую кнопку. Владелец поймал это сразу.
             *
             * Верхние 38 точек — под плашку стадии и гизмо осей, следующие
             * ~62 — полоса, в которой живёт облако. Призрак начинается ниже
             * и НЕ ДВИГАЕТСЯ, что бы призрак ни сказал.
             */}
            <div className="relative flex flex-col items-center pt-[96px] pb-0">
              {/* Полоса реплики: облако и, если призрак зовёт в чат, кнопка
                  под ним. Вся полоса ПОВЕРХ потока — поэтому что бы призрак
                  ни сказал и сколько бы строк это ни заняло, он остаётся
                  на месте, а комната не растёт. */}
              <div className="absolute top-[38px] left-0 right-0 z-10 flex flex-col items-center px-3">
              <motion.div
                key={phrase}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`relative max-w-[80%] border shadow-md rounded-2xl px-4 py-2.5 z-10 ${
                  tip
                    ? "bg-amber-50 border-amber-200 shadow-amber-200/50 dark:bg-amber-500/15 dark:border-amber-500/40 dark:shadow-black/40"
                    : "bg-white border-slate-100 shadow-slate-200/60 dark:bg-card dark:border-border dark:shadow-black/40"
                }`}
              >
                <p
                  className={`text-sm font-bold text-center ${
                    tip
                      ? "text-amber-700 dark:text-amber-200"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {tip && <span className="mr-1">💡</span>}
                  {phrase}
                </p>
                <div
                  className={`absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 border-b border-r rotate-45 ${
                    tip
                      ? "bg-amber-50 border-amber-200 dark:bg-amber-500/15 dark:border-amber-500/40"
                      : "bg-white border-slate-100 dark:bg-card dark:border-border"
                  }`}
                />
              </motion.div>

              {showCommunityDoor && (
                <button
                  onClick={() => {
                    hapticTap();
                    openOutboundLink(COMMUNITY_LINK);
                  }}
                  className="z-10 mt-3 flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50/80 px-3 py-1 text-[11px] font-bold text-sky-600 transition-transform active:scale-95 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300"
                >
                  Открыть чат школы →
                </button>
              )}
              </div>

              {/* Призрак. Отступа сверху больше НЕТ и он не нужен: облако
                  вынесено из потока, а место под него забронировано верхним
                  padding'ом комнаты. Шляпа торчит выше макушки на 12% кадра
                  и попадает ровно в это забронированное место. */}
              <div className="relative flex items-center justify-center">
                {/* Сердечки от поглаживания */}
                <AnimatePresence>
                  {hearts.map((heart) => (
                    <motion.div
                      key={heart.id}
                      initial={{ opacity: 1, y: 0, scale: 0.7 }}
                      animate={{ opacity: 0, y: -70, scale: 1.15 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="absolute top-6 z-10 pointer-events-none text-lg font-bold text-rose-500"
                      style={{ left: `calc(50% + ${heart.x}px)` }}
                    >
                      {heart.withXp ? "❤️ +1 XP" : "❤️"}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Внешний слой парит, внутренний слушается пальца:
                    два разных transform на одном элементе конфликтуют */}
                <motion.div
                  animate={{ y: animation.y }}
                  transition={{
                    duration: animation.duration,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{ perspective: 700 }}
                >
                  <motion.div
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.55}
                    dragMomentum={false}
                    onDragStart={() => {
                      draggingRef.current = true;
                      hapticTap("soft");
                    }}
                    onDragEnd={() => {
                      // Небольшая пауза: палец отрывается позже, чем кончается
                      // перетаскивание, иначе бросок засчитается поглаживанием.
                      window.setTimeout(() => {
                        draggingRef.current = false;
                      }, 60);
                    }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePet}
                    className="flex items-center justify-center select-none cursor-pointer touch-pan-y"
                    style={{
                      x: swing,
                      rotateY,
                      rotate: tilt,
                      // Оранжевый контур «выбранного объекта», как в Blender
                      filter: "drop-shadow(0 0 2px rgba(249, 115, 22, 0.75))",
                    }}
                  >
                    {/* ⚠️ Размер ЖЁСТКИЙ и таким должен остаться. Пробовали
                        резиновый (`fill`) — призрак ужимался от длинной
                        реплики и на невысоком телефоне, владелец назвал это
                        фатальным. Хочешь больше места экрану — убирай другие
                        блоки, а не уменьшай призрака. */}
                    <Ghost
                      stage={stage}
                      mood={mood}
                      size={240}
                      overlays={wornOverlays}
                    />
                  </motion.div>
                </motion.div>
              </div>

              {/* Подсказка исчезает, как только ребёнок погладил призрака
                  хоть раз: она нужна ровно до первого касания, а дальше
                  занимает строку в комнате и повторяет очевидное. */}
              {pettingTaps < PETTING_HINT_TAPS && (
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/85 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700/70 rounded-full px-4 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-300 shadow-sm select-none">
                  Погладь · потяни вбок — покрутится
                </span>
              )}
            </div>

            {/* Подсказки поверх комнаты: тап мимо — закрыть */}
            <AnimatePresence>
              {hint && (
                <motion.div
                  key={hint}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => setHint(null)}
                  className="absolute inset-0 z-30 flex items-center justify-center px-4 bg-slate-900/45 backdrop-blur-[2px]"
                >
                  <motion.div
                    initial={{ scale: 0.92, y: 8 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95 }}
                    transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
                    className="w-full max-w-[17rem] rounded-2xl bg-white dark:bg-card border border-slate-200 dark:border-border shadow-xl p-4"
                  >
                    {hint === "stage" ? (
                      <>
                        <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-secondary mb-1">
                          Ступень {stageNumber} из {PET_STAGES.length} · путь творца
                        </p>
                        <h4 className="font-display font-bold text-slate-800 dark:text-slate-100 mb-1.5">
                          {stage.name}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {stage.about}
                        </p>
                        <p className="mt-2.5 text-xs font-bold text-slate-400 dark:text-slate-500">
                          {nextStage
                            ? `Дальше: ${nextStage.name} на ${nextStage.fromLevel} уровне`
                            : "Это последняя ступень — выше некуда"}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-primary mb-1.5">
                          Оси координат
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2.5">
                          Такой значок висит в углу окна Blender и показывает,
                          куда смотрит сцена. Три оси — три направления:
                        </p>
                        <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                          <li className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#e3402e] shrink-0" />
                            <b className="font-mono">X</b> — вправо и влево
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#6fa21c] shrink-0" />
                            <b className="font-mono">Y</b> — вперёд и назад
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#3b83bd] shrink-0" />
                            <b className="font-mono">Z</b> — вверх и вниз
                          </li>
                        </ul>
                        <p className="mt-2.5 text-xs font-bold text-slate-400 dark:text-slate-500 leading-snug">
                          В Blender нажми G, а потом X, Y или Z — объект поедет
                          строго вдоль этой оси и никуда не съедет.
                        </p>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <CarePanel />

          {/* Единственная оранжевая кнопка главного экрана */}
          <Link
            data-tour="today"
            href="/quests"
            onClick={() => hapticTap("medium")}
            className={`w-full max-w-sm flex items-center gap-3 rounded-2xl px-4 py-3.5 border transition-all active:scale-[0.98] ${
              todo.tone === "action"
                ? "bg-gradient-to-r from-secondary to-orange-400 border-transparent text-white shadow-lg shadow-secondary/30"
                : todo.tone === "waiting"
                  ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300"
                  : "bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300"
            }`}
          >
            {todo.tone === "action" ? (
              <Scroll className="w-5 h-5 shrink-0" />
            ) : todo.tone === "waiting" ? (
              <Clock className="w-5 h-5 shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 shrink-0" />
            )}

            <span className="flex-1 min-w-0 text-sm font-bold leading-snug">
              {todo.text}
            </span>

            <ChevronRight className="w-5 h-5 shrink-0 opacity-70" />
          </Link>

          {/* Строка «Стадия N из 5 · эволюция на N ур.» здесь была и удалена:
              то же самое, слово в слово, рассказывает плашка стадии в углу
              комнаты, если по ней нажать — там и номер ступени, и что дальше.
              Два раза одно и то же на экране, который принадлежит призраку. */}

          {/* Гардероб одной строкой: надетое — в цвете и с ободком, остальное
              лежит бледным. Нажатие переодевает прямо здесь: владелец просил
              мерить и сравнивать, не уходя в магазин и не возвращаясь обратно
              ради каждой вещи. Остаётся ИМЕННО ЗДЕСЬ: примерка с главного
              экрана — его отдельная просьба, уносить её к инвентарю нельзя. */}
          {ownedItems.length > 0 && (
            <div className="flex flex-col items-center max-w-xs">
              <div className="flex flex-wrap justify-center gap-1.5">
                {ownedItems.map((item) => {
                  const Icon = item.icon;
                  const worn = isItemWorn(equipped, item);

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        hapticSelect();
                        if (worn) takeOffItem(item.id);
                        else wearItem(item.id);
                      }}
                      title={`${item.name} · ${getClothingSlot(item.slot).name}${
                        worn ? " · надето" : ""
                      }`}
                      aria-label={`${item.name} — ${worn ? "снять" : "надеть"}`}
                      aria-pressed={worn}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-transform active:scale-90 ${
                        worn
                          ? `${item.bg} ${item.color} ring-2 ring-secondary`
                          : "bg-slate-100 text-slate-400 dark:bg-muted dark:text-slate-500 opacity-70"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>

              <span className="mt-2 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                Нажми на вещь — надеть или снять
              </span>
            </div>
          )}

          {/* Подсказка, что экран не кончился.

              ⚠️ ОНА ВНЕ ПОТОКА (absolute), и это уже третий заход. Сначала
              строчка стояла последней в колонке — её не увидел вообще никто:
              экран был выше окна, и подсказка про продолжение сама пряталась
              за тем краем, о котором рассказывала. Потом её приклеили к низу
              (`sticky`) — и она стала НАЕЗЖАТЬ на оранжевую кнопку, владелец
              прислал скриншот.

              Теперь она не занимает места вовсе и висит у самого низа экрана,
              под кнопкой. Экран после выноса облака из потока помещается
              в окно целиком, поэтому наезжать больше не на что. */}
          <div className="absolute bottom-1 left-0 right-0 z-0 flex flex-col items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <span className="text-[11px] font-bold">Листай вверх</span>
            <ChevronDown className="w-4 h-4" />
          </div>
        </section>

        {/**
         * ЭКРАНЫ 2 и 3.
         *
         * `justify-center` — не украшение. Владелец 27.07: «очень много
         * пустого пространства, посмотри сколько внизу — вообще ничем
         * не занято, тупо чёрный экран, а на светлой теме тупо белый».
         * Содержимое короче окна, и прижатое кверху оно оставляло внизу
         * глухую плиту пустоты. Посередине пустота делится пополам
         * и перестаёт читаться как «тут что-то не догрузилось».
         */}
        <section className="snap-start min-h-full px-5 py-4 flex flex-col justify-center">
          <GrowthSection />
        </section>

        <section className="snap-start min-h-full px-5 py-4 flex flex-col justify-center">
          <FriendsSection />
        </section>
      </div>
      </div>
    </motion.div>
  );
}
