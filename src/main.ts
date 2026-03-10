import { Plugin, Vault, Notice, WorkspaceLeaf } from "obsidian";
import { PomodoroSettings, DEFAULT_SETTINGS, SessionData, TimerState } from "./types";
import { TimerManager } from "./TimerManager";
import { LogManager, VaultAdapter } from "./LogManager";
import { NotificationManager } from "./NotificationManager";
import { SidebarView, VIEW_TYPE_POMODORO } from "./SidebarView";
import { validateSettings } from "./validation";

// Adapter to make Obsidian Vault compatible with VaultAdapter interface
class ObsidianVaultAdapter implements VaultAdapter {
  constructor(private vault: Vault) {}

  async exists(path: string): Promise<boolean> {
    return await this.vault.adapter.exists(path);
  }

  async read(path: string): Promise<string> {
    return await this.vault.adapter.read(path);
  }

  async write(path: string, data: string): Promise<void> {
    await this.vault.adapter.write(path, data);
  }
}

// Interface for persisted timer state
interface PersistedTimerState {
  state: Omit<TimerState, 'startTime'> & { startTime: string | null };
  timestamp: number;
}

export default class PomodoroPlugin extends Plugin {
  settings: PomodoroSettings = DEFAULT_SETTINGS;
  timerManager: TimerManager | null = null;
  logManager: LogManager | null = null;
  notificationManager: NotificationManager | null = null;
  sidebarView: SidebarView | null = null;

  async onload() {
    console.log("Loading Enhanced Pomodoro Timer plugin");

    // Load settings
    await this.loadSettings();

    // Initialize components
    this.timerManager = new TimerManager(this.settings);
    this.logManager = new LogManager(
      new ObsidianVaultAdapter(this.app.vault),
      this.settings.logFilePath
    );
    this.notificationManager = new NotificationManager({
      soundEnabled: this.settings.soundEnabled,
    });

    // Register auto-save callback
    this.timerManager.onSaveState(async (serializedState) => {
      await this.saveTimerState(serializedState as TimerState);
    });

    // Register event handlers
    this.timerManager.onTick((remainingSeconds, totalSeconds) => {
      this.onTimerTick(remainingSeconds, totalSeconds);
    });

    this.timerManager.onComplete((sessionData) => {
      this.onTimerComplete(sessionData);
    });

    // Register sidebar view
    this.registerView(
      VIEW_TYPE_POMODORO,
      (leaf) => {
        this.sidebarView = new SidebarView(leaf, this);
        return this.sidebarView;
      }
    );

    // Check for incomplete session
    await this.checkIncompleteSession();

    // Add command to open sidebar
    this.addCommand({
      id: "open-pomodoro-sidebar",
      name: "Open Pomodoro Timer",
      callback: () => {
        this.activateSidebarView();
      },
    });

    // Activate sidebar view on load
    if (this.app.workspace) {
      this.activateSidebarView();
    }
  }

  async onunload() {
    console.log("Unloading Enhanced Pomodoro Timer plugin");

    if (this.timerManager) {
      const state = this.timerManager.getState();
      
      if (state.isRunning) {
        this.timerManager.stopInterval();
        
        try {
          await this.saveTimerState(state);
          console.log("Timer state saved on unload:", state.taskName);
        } catch (e) {
          console.error("Failed to save timer state on unload:", e);
        }
      }
    }

    this.timerManager = null;
    this.logManager = null;
    this.notificationManager = null;
    this.sidebarView = null;
  }

  // Load settings from disk
  async loadSettings(): Promise<void> {
    try {
      const data = await this.loadData();
      const rawSettings = data?.settings || {};
      
      // Validate and sanitize settings
      const validated = validateSettings(rawSettings);
      
      // Show warnings to user if any
      if (validated.warnings.length > 0) {
        console.warn("Settings validation warnings:", validated.warnings);
        new Notice(`⚠️ Settings issues detected:\n${validated.warnings.join('\n')}`, 8000);
      }
      
      // Apply validated settings
      this.settings = {
        workDuration: validated.workDuration,
        breakDuration: validated.breakDuration,
        soundEnabled: validated.soundEnabled,
        logFilePath: validated.logFilePath,
      };
    } catch (error) {
      console.error("Failed to load settings, using defaults", error);
      this.settings = { ...DEFAULT_SETTINGS };
      new Notice("⚠️ Failed to load settings, using defaults", 5000);
    }
  }

  // Save settings to disk
  async saveSettings(): Promise<void> {
    try {
      // Validate settings before saving
      const validated = validateSettings(this.settings);
      
      // Show warnings if any
      if (validated.warnings.length > 0) {
        console.warn("Settings validation warnings:", validated.warnings);
        new Notice(`⚠️ Settings corrected:\n${validated.warnings.join('\n')}`, 8000);
      }
      
      // Apply validated settings
      this.settings = {
        workDuration: validated.workDuration,
        breakDuration: validated.breakDuration,
        soundEnabled: validated.soundEnabled,
        logFilePath: validated.logFilePath,
      };
      
      // Save to disk
      await this.saveData({ settings: this.settings });
      
      // Propagate settings to managers
      if (this.timerManager) {
        this.timerManager.updateSettings(this.settings);
      }
      
      if (this.notificationManager) {
        this.notificationManager.updateSettings({
          soundEnabled: this.settings.soundEnabled,
        });
      }
    } catch (error) {
      console.error("Failed to save settings", error);
      new Notice("⚠️ Failed to save settings. Changes may not persist.", 5000);
    }
  }

  // Event handler: Timer tick
  private onTimerTick(remainingSeconds: number, totalSeconds: number): void {
    if (this.sidebarView) {
      this.sidebarView.updateTimerDisplay(remainingSeconds, totalSeconds);
    }
  }

  // Event handler: Timer complete
  private async onTimerComplete(sessionData: SessionData): Promise<void> {
    try {
      // Log the completed session
      if (this.logManager) {
        const result = await this.logManager.appendSession(sessionData);
        if (!result.ok) {
          console.error("Failed to log session:", result.error);
          new Notice("⚠️ Failed to save session to log. Session data may be lost.", 8000);
          // Continue execution - don't let log failure stop notifications
        }
      }

      // Show completion notification
      if (this.notificationManager) {
        this.notificationManager.notifyTimerCompleted(sessionData.status === "completed" ? "work" : "break");
      }

      // Refresh statistics in sidebar
      if (this.sidebarView) {
        try {
          const sessions = await this.logManager?.readAllSessions() || [];
          const { StatisticsCalculator } = await import("./StatisticsCalculator");
          const stats = StatisticsCalculator.calculate(sessions);
          this.sidebarView.updateStatistics(stats);
        } catch (statsError) {
          console.error("Failed to refresh statistics", statsError);
          new Notice("⚠️ Failed to refresh statistics. Check console for details.", 5000);
        }
        
        // Update button states to reflect stopped timer
        if (this.timerManager) {
          this.sidebarView.updateControlButtons(this.timerManager.getState());
        }
      }

      // Clear persisted state
      await this.clearTimerState();
    } catch (error) {
      console.error("Failed to handle timer completion", error);
      // Show user-facing error for critical failure
      new Notice("⚠️ Failed to complete timer session. Check console for details.", 8000);
    }
  }

  // Activate sidebar view
  private async activateSidebarView(): Promise<void> {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_POMODORO);

    if (leaves.length > 0) {
      // View already exists, reveal it
      leaf = leaves[0];
    } else {
      // Create new leaf in right sidebar
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: VIEW_TYPE_POMODORO,
          active: true,
        });
      }
    }

    // Reveal the leaf
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  // Check for incomplete session on startup
  private async checkIncompleteSession(): Promise<void> {
    try {
      const data = await this.loadData();
      const persistedState: PersistedTimerState | null = data?.timerState || null;

      console.log("Checking for incomplete session:", persistedState);

      if (persistedState && persistedState.state.isRunning) {
        const hoursSinceClose = (Date.now() - persistedState.timestamp) / (1000 * 60 * 60);
        
        console.log("Found running session, hours since close:", hoursSinceClose);
        
        if (hoursSinceClose > 24) {
          console.log("Ignoring stale timer state (older than 24 hours)");
          await this.clearTimerState();
          return;
        }

        const state = persistedState.state;
        
        const incompleteSession: SessionData = {
          date: new Date().toISOString().split('T')[0],
          startTime: state.startTime 
            ? new Date(state.startTime).toTimeString().split(' ')[0]
            : "00:00:00",
          duration: Math.floor(state.totalSeconds / 60),
          taskName: state.taskName,
          status: "incomplete",
        };

        console.log("Logging incomplete session:", incompleteSession);

        if (this.logManager) {
          const result = await this.logManager.appendSession(incompleteSession);
          if (!result.ok) {
            console.error("Failed to log incomplete session:", result.error);
            new Notice(`⚠️ Failed to log incomplete session: ${result.error.message}`, 8000);
          } else {
            new Notice(`📝 Session "${state.taskName}" logged as incomplete`, 5000);
          }
        }

        if (this.notificationManager) {
          this.notificationManager.notifyIncompleteSession(
            state.taskName,
            state.remainingSeconds
          );
        }

        await this.clearTimerState();
      }
    } catch (error) {
      console.error("Failed to check incomplete session", error);
    }
  }

  // Save timer state for recovery
  private async saveTimerState(state: TimerState): Promise<void> {
    try {
      const data = await this.loadData();
      const persistedState: PersistedTimerState = {
        state: {
          ...state,
          // Convert Date to ISO string for serialization
          startTime: state.startTime ? state.startTime.toISOString() : null,
        },
        timestamp: Date.now(),
      };
      
      await this.saveData({
        ...data,
        timerState: persistedState,
      });
    } catch (error) {
      console.error("Failed to save timer state", error);
      new Notice("⚠️ Failed to save timer state. Session may not be recoverable if app closes.", 5000);
    }
  }

  // Clear persisted timer state
  private async clearTimerState(): Promise<void> {
    try {
      const data = await this.loadData();
      if (data?.timerState) {
        delete data.timerState;
        await this.saveData(data);
      }
    } catch (error) {
      console.error("Failed to clear timer state", error);
      // Non-critical error - don't show Notice to user
    }
  }
}
