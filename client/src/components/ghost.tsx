import type { PetMood, PetStage } from "@/lib/pet-config";

// The mascot is drawn entirely in SVG — no image files, loads instantly,
// and every stage/mood combination is just different shapes.

const BODY_PATH =
  "M40,102 C40,58 66,30 100,30 C134,30 160,58 160,102 L160,168 " +
  "Q150,181 140,168 Q130,181 120,168 Q110,181 100,168 " +
  "Q90,181 80,168 Q70,181 60,168 Q50,181 40,168 Z";

function Star({ x, y, size }: { x: number; y: number; size: number }) {
  const inner = size * 0.32;
  const d = `M0,${-size} L${inner},${-inner} L${size},0 L${inner},${inner} L0,${size} L${-inner},${inner} L${-size},0 L${-inner},${-inner} Z`;

  return <path d={d} transform={`translate(${x} ${y})`} fill="#FACC15" />;
}

export function Ghost({
  stage,
  mood = "idle",
  size = 260,
}: {
  stage: PetStage;
  mood?: PetMood;
  size?: number;
}) {
  const uid = `ghost-${stage.fromLevel}`;
  const isWorried = mood === "worried";
  const isHappy = mood === "happy" || mood === "potion";

  return (
    <svg
      width={size}
      height={size * 0.95}
      viewBox="0 0 200 190"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`body-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stage.bodyLight} />
          <stop offset="100%" stopColor={stage.bodyDark} />
        </linearGradient>
        <clipPath id={`clip-${uid}`}>
          <path d={BODY_PATH} />
        </clipPath>
      </defs>

      {/* Ручки */}
      <ellipse
        cx="30"
        cy="120"
        rx="15"
        ry="9"
        fill={stage.bodyDark}
        transform="rotate(-24 30 120)"
      />
      <ellipse
        cx="170"
        cy="120"
        rx="15"
        ry="9"
        fill={stage.bodyDark}
        transform="rotate(24 170 120)"
      />

      {/* Тело */}
      <path d={BODY_PATH} fill={`url(#body-${uid})`} />
      <path
        d={BODY_PATH}
        fill="none"
        stroke={stage.bodyDark}
        strokeOpacity="0.35"
        strokeWidth="2"
      />

      {/* Подгузник малыша */}
      {stage.accessory === "diaper" && (
        <g>
          <g clipPath={`url(#clip-${uid})`}>
            <rect x="36" y="150" width="128" height="42" fill="#FFFFFF" />
            <path d="M36,150 L164,150" stroke="#BFDBFE" strokeWidth="3" />
          </g>
          <circle cx="100" cy="163" r="3.5" fill="#FACC15" />
          {/* Кудряшка на макушке */}
          <path
            d="M100,30 Q96,15 108,11"
            stroke={stage.bodyDark}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      )}

      {/* Глаза */}
      <ellipse cx="80" cy="92" rx="11" ry="13" fill="#FFFFFF" />
      <ellipse cx="120" cy="92" rx="11" ry="13" fill="#FFFFFF" />
      <circle cx="82" cy="95" r="5.5" fill="#1E3A8A" />
      <circle cx="118" cy="95" r="5.5" fill="#1E3A8A" />
      <circle cx="84.5" cy="91" r="2" fill="#FFFFFF" />
      <circle cx="120.5" cy="91" r="2" fill="#FFFFFF" />

      {/* Румянец */}
      <ellipse cx="68" cy="111" rx="7" ry="4" fill="#F9A8D4" opacity="0.55" />
      <ellipse cx="132" cy="111" rx="7" ry="4" fill="#F9A8D4" opacity="0.55" />

      {/* Брови и рот по настроению */}
      {isWorried && (
        <g stroke="#1E3A8A" strokeWidth="3.5" strokeLinecap="round" fill="none">
          <path d="M70,75 Q80,67 90,73" />
          <path d="M130,75 Q120,67 110,73" />
        </g>
      )}

      {isWorried ? (
        <path
          d="M88,133 Q100,122 112,133"
          stroke="#1E3A8A"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      ) : isHappy ? (
        <path d="M83,120 Q100,144 117,120 Q100,128 83,120" fill="#1E3A8A" />
      ) : (
        <path
          d="M88,122 Q100,133 112,122"
          stroke="#1E3A8A"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Искры зелья */}
      {mood === "potion" && (
        <g>
          <Star x={50} y={48} size={7} />
          <Star x={152} y={38} size={5} />
          <Star x={162} y={70} size={4} />
        </g>
      )}

      {/* Шапочка практиканта */}
      {stage.accessory === "beanie" && (
        <g>
          <path d="M58,54 Q60,22 100,20 Q140,22 142,54 Q100,42 58,54 Z" fill="#F97316" />
          <path d="M56,52 Q100,38 144,52 Q100,62 56,52 Z" fill="#FB923C" />
          <circle cx="100" cy="16" r="8" fill="#FDBA74" />
        </g>
      )}

      {/* Очки умельца */}
      {stage.accessory === "glasses" && (
        <g stroke="#7C3AED" strokeWidth="4">
          <circle cx="80" cy="92" r="15" fill="rgba(255,255,255,0.18)" />
          <circle cx="120" cy="92" r="15" fill="rgba(255,255,255,0.18)" />
          <path d="M95,92 L105,92" fill="none" />
          <path d="M65,92 L56,86" fill="none" />
          <path d="M135,92 L144,86" fill="none" />
        </g>
      )}

      {/* Академическая шапка мастера */}
      {stage.accessory === "gradcap" && (
        <g>
          <path d="M78,40 L122,40 L122,52 Q100,60 78,52 Z" fill="#172554" />
          <polygon points="100,8 154,27 100,46 46,27" fill="#1E3A8A" />
          <circle cx="100" cy="27" r="3.5" fill="#FACC15" />
          <path d="M154,27 L158,46" stroke="#FACC15" strokeWidth="3" fill="none" />
          <circle cx="158" cy="50" r="4" fill="#FACC15" />
        </g>
      )}

      {/* Корона легенды */}
      {stage.accessory === "crown" && (
        <g>
          <polygon
            points="64,52 74,24 88,42 100,16 112,42 126,24 136,52"
            fill="#FACC15"
            stroke="#F59E0B"
            strokeWidth="2"
          />
          <rect x="64" y="50" width="72" height="10" rx="4" fill="#F59E0B" />
          <circle cx="100" cy="55" r="3" fill="#FB7185" />
          <circle cx="82" cy="55" r="2.5" fill="#60A5FA" />
          <circle cx="118" cy="55" r="2.5" fill="#34D399" />
        </g>
      )}
    </svg>
  );
}
