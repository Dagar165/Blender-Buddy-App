## Packages
zustand | Robust state management for game state (level, xp, gold) with local storage persistence
framer-motion | Essential for cute, bouncy, kid-friendly animations
canvas-confetti | Reward effects for completing quests
@types/canvas-confetti | Types for canvas-confetti

## Notes
- LocalStorage is used for all state persistence (no backend API required for the MVP game loop).
- Framer Motion is used for the mascot's floating animation and UI entry effects.
- Telegram WebApp is safely initialized via window.Telegram check.
- Mobile-first layout is constrained to `max-w-md` on larger screens to simulate a mobile app frame.
