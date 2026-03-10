# Enhanced Pomodoro Timer for Obsidian

Improved Pomodoro timer plugin with sidebar UI, session logging, statistics, and notifications.

## Features

- 🎯 Sidebar panel with timer controls
- ⏯️ Start/Pause/Resume functionality
- 📝 Task name input with validation
- ⚙️ Configurable work/break durations
- 📊 Statistics (today/week/month)
- 📋 Session log in Markdown table format
- 🔔 Visual and sound notifications
- 💾 Incomplete session recovery

## Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Development mode** (auto-rebuild on changes):
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

5. **Run tests in watch mode:**
   ```bash
   npm run test:watch
   ```

## Project Structure

```
src/
├── main.ts                 # Plugin entry point
├── TimerManager.ts         # Timer logic with Date-based accuracy
├── LogManager.ts           # Session logging to Markdown
├── LogParser.ts            # Parse Markdown table
├── StatisticsCalculator.ts # Calculate statistics
├── NotificationManager.ts  # Handle notifications
├── SidebarView.ts          # UI components
└── types.ts                # TypeScript interfaces
```

## Testing

The project uses a dual testing approach:
- **Unit tests**: Specific examples and edge cases
- **Property-based tests**: Universal properties with fast-check (100+ iterations)

Coverage target: ≥80%

## Spec-Driven Development

This plugin follows the spec-driven development workflow. See `.kiro/specs/enhanced-pomodoro-timer/` for:
- `requirements.md` - User stories and acceptance criteria
- `design.md` - Architecture and correctness properties
- `tasks.md` - Implementation plan

## License

MIT
