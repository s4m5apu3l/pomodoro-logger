# Quick Start Guide

## Initial Setup

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Verify the build works:**
   ```bash
   npm run build
   ```
   This should create `main.js` in the root directory.

3. **Run tests (optional, will fail until implementation):**
   ```bash
   npm test
   ```

## Development Workflow

### Option 1: Auto-rebuild (Recommended)
```bash
npm run dev
```
This watches for file changes and rebuilds automatically.

### Option 2: Manual build
```bash
npm run build
```

## Testing in Obsidian

1. Copy this plugin folder to your Obsidian vault's `.obsidian/plugins/` directory
2. Enable the plugin in Obsidian Settings → Community Plugins
3. Reload Obsidian or use the "Reload app without saving" command

## Implementation

Follow the tasks in `.kiro/specs/enhanced-pomodoro-timer/tasks.md`:

1. Start with Task 1 (project structure and interfaces) ✅ DONE
2. Continue with Task 2 (TimerManager implementation)
3. Work through tasks sequentially or pick specific ones

Each task includes:
- Clear implementation requirements
- Property-based tests to write
- Unit tests to write
- References to requirements

## File Structure

```
.
├── src/
│   ├── main.ts              # Plugin entry (minimal starter)
│   └── types.ts             # TypeScript interfaces ✅
├── .kiro/specs/enhanced-pomodoro-timer/
│   ├── requirements.md      # User stories
│   ├── design.md            # Architecture
│   └── tasks.md             # Implementation plan
├── package.json             # Dependencies ✅
├── tsconfig.json            # TypeScript config ✅
├── esbuild.config.mjs       # Build config ✅
├── jest.config.js           # Test config ✅
└── manifest.json            # Obsidian plugin manifest ✅
```

## Next Steps

You're ready to start implementing! Open `tasks.md` and begin with Task 2 (TimerManager).

**Note:** Task 1 is already complete - the project structure and base interfaces are set up.
