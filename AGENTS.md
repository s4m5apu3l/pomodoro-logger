# AGENTS.md

## Project

Obsidian plugin (id: `obsidian-pomodoro-logger`, package name `obsidian-enhanced-pomodoro-timer` — names differ). Bundled via esbuild into a single `main.js` + `styles.css` that users drop into their vault's `.obsidian/plugins/` folder.

## Commands

- `npm run dev` — watch mode, auto-rebuild on changes (copies `src/styles.css` → root on each rebuild)
- `npm run build` — type-checks (`tsc -noEmit -skipLibCheck`) then production bundle
- `npm test` — Jest with ts-jest, jsdom environment
- `npm run test:watch` — Jest watch mode

No linter, formatter, CI, or pre-commit hooks configured.

## Architecture

All source lives in `src/`. Single entrypoint: `src/main.ts`.

| File | Role |
|------|------|
| `src/main.ts` | Plugin class (`PomodoroPlugin`), wires managers together, `ObsidianVaultAdapter` |
| `src/TimerManager.ts` | Timer state machine (start/pause/resume/stop), Date-based accuracy |
| `src/LogManager.ts` | Reads/writes `pomodoro-log.md` via `VaultAdapter` interface (not raw Vault) |
| `src/LogParser.ts` | Markdown table ↔ `SessionData` conversion, handles escaped `\|` in task names |
| `src/NotificationManager.ts` | Obsidian notices + AudioContext sound; declares `Notice` as `declare global` |
| `src/StatisticsCalculator.ts` | Aggregates session stats by period (static methods), week starts Monday |
| `src/SidebarView.ts` | Obsidian ItemView, all UI rendering, quick-start pills (25m/15m/45m) |
| `src/validation.ts` | `validateTaskName`, `validateSettings`, `truncateTaskName`, `Result<T,E>` |
| `src/types.ts` | Core interfaces + `DEFAULT_SETTINGS`, `PeriodStats`, `NotificationSettings` |

## Build quirks

- esbuild bundles `src/main.ts` → root `main.js` (CJS format); externals include `obsidian`, `electron`, all `@codemirror/*`, all `@lezer/*`, and Node builtins
- esbuild plugin copies `src/styles.css` → root `styles.css` on every rebuild end
- **`main.js` and `styles.css` are git-tracked generated files** — never edit directly; changes after `npm run dev`/`npm run build` will show as modified
- `data.json` is also git-tracked — this is runtime plugin state (settings, timer persistence); avoid committing changes to it
- `manifest.json` is required by Obsidian to load the plugin (contains id, version, minAppVersion)
- Dev builds: inline sourcemaps; production builds: no sourcemaps
- TypeScript target is ES6 but esbuild target is `es2018` (standard Obsidian plugin template)
- `tsconfig.json` has `noImplicitAny` and `strictNullChecks` enabled

## Non-obvious patterns

- **Dynamic import for StatisticsCalculator** — `SidebarView` and `main.ts` use `await import("./StatisticsCalculator")` instead of static import (lazy loading)
- **Timer accuracy** — `window.setInterval(1000ms)` only drives UI ticks; actual remaining time is computed from `Date.now() - startTime`, not counter decrement
- **Timer state persistence** — auto-saved every 30 ticks (~30s) and on plugin unload; on reload, states older than 24h are discarded; `startTime` serialized as ISO string
- **VaultAdapter abstraction** — `LogManager` depends on a `VaultAdapter` interface; `main.ts` implements `ObsidianVaultAdapter` to bridge to Obsidian's actual vault API
- **NotificationManager declares `Notice` globally** — uses `declare global { class Notice { ... } }` so TypeScript recognizes `new Notice(...)` without import

## Testing

- Jest with `ts-jest` preset, `jsdom` environment
- Tests go in `src/__tests__/` — one file per module
- `obsidian` module is mocked via `src/__mocks__/obsidian.ts` (jest `moduleNameMapper`)
- AudioContext is mocked via `src/__mocks__/audioContext.ts` (jest `setupFilesAfterEnv`)
- Property-based tests use `fast-check` — shared arbitraries in `src/__test_helpers__/test-arbitraries.ts`
- PBT config: 100 runs minimum (`DEFAULT_PBT_CONFIG`)
- Coverage thresholds enforced: 80% branches/functions/lines/statements
- Run a single test: `npx jest src/__tests__/TimerManager.test.ts`

## Spec reference

`.kiro/specs/enhanced-pomodoro-timer/` contains `requirements.md`, `design.md`, `tasks.md` — written in Russian, defines 20 formal correctness properties and implementation checklist.
