# Z-Sudoku

A progressive web app (PWA) for playing and learning Sudoku, built with React + Vite.

**Live:** https://izep.github.io/z-sudoku/

---

## Features

- **Human-strategy solver** — 13 named techniques (Naked Single → XYZ-Wing)
- **Two-press hint system** — first press highlights the pattern, second reveals the answer with a plain-English explanation
- **Pencil notes** — tap to toggle candidates; notes auto-clear when peers are filled
- **Difficulty slider** — 0.0 (Trivial) → 1.0 (Maximum), scored against a weighted strategy table
- **Adaptive difficulty** — adjusts based on your solve speed after each puzzle
- **Error mode** — toggle whether mistakes are highlighted immediately
- **Score & high scores** — `difficulty × 1/log(time)`, penalised 10% per hint, persisted in `localStorage`
- **Timer** — tap to pause/resume
- **Undo** — unlimited steps back
- **Full keyboard support** — arrows, 1–9, Backspace, P (pencil), Ctrl+Z, H (hint)
- **PWA** — installable on desktop and iPhone (Safari → Share → Add to Home Screen)
- **Offline-capable** — service worker caches all assets

## Tech stack

| Layer | Tool |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| PWA | vite-plugin-pwa (Workbox) |
| CI/CD | GitHub Actions → GitHub Pages |
| Solver/Generator | Pure TypeScript, no dependencies |

## Development

```bash
# Requires Node 24+
npm install
npm run dev        # http://localhost:5173/z-sudoku/
npm run build      # production build → dist/
npm run preview    # preview production build
npm run lint       # type-check only (no emit)
```

## CI/CD

Every push to `main`:
1. **Build job** — installs deps, type-checks, builds with Vite
2. **Deploy job** — uploads `dist/` to GitHub Pages via `actions/deploy-pages`

Pull requests run the build job only (no deploy).

The workflow file is at `.github/workflows/deploy.yml`.

## Enabling GitHub Pages

In the repo settings:
- **Settings → Pages → Source → GitHub Actions**

That's all — the workflow handles everything else.

## Difficulty scale

| Level | Score range | Strategies typically required |
|---|---|---|
| Trivial | 0.0 – 0.15 | Naked Singles |
| Easy | 0.15 – 0.38 | + Hidden Singles |
| Medium | 0.38 – 0.62 | + Pointing Pairs, Naked Pairs |
| Hard | 0.62 – 0.85 | + X-Wing, Y-Wing |
| Maximum | 0.85 – 1.0 | + Swordfish, Jellyfish, XYZ-Wing |

## Adding a new solving strategy

1. Implement the function in `src/engine/sudoku.ts` and add it to the solver loop
2. Add one line to `STRATEGY_WEIGHTS` with an appropriate difficulty weight
3. The difficulty scale and generator re-anchor automatically
