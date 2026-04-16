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
  state: Omit<TimerState, 'startTime' | 'pauseStartTime'> & { startTime: string | null; pauseStartTime: string | null };
  timestamp: number;
}

export default class PomodoroPlugin extends Plugin {
  settings: PomodoroSettings = DEFAULT_SETTINGS;
  timerManager: TimerManager | null = null;
  logManager: LogManager | null = null;
  notificationManager: NotificationManager | null = null;
  sidebarView: SidebarView | null = null;
  private _pendingSession: SessionData | null = null;

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

      if (this._pendingSession) {
        try {
          const data = await this.loadData();
          data.pendingSession = this._pendingSession;
          await this.saveData(data);
        } catch (e) {
          console.error("Failed to save pending session on unload:", e);
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
      this.sidebarView.updateProgress(remainingSeconds, totalSeconds);
    }
  }

  // Event handler: Timer complete
  private async onTimerComplete(sessionData: SessionData): Promise<void> {
    this._pendingSession = sessionData;

    try {
      if (this.logManager) {
        const result = await this.logManager.appendSession(sessionData);
        if (!result.ok) {
          console.error("Failed to log session:", result.error);
          new Notice("⚠️ Failed to save session to log. Session data may be lost.", 8000);
        }
      }

      const sessionType = sessionData.sessionType ?? 'work';

      if (sessionData.status === "completed") {
        this.notificationManager?.notifyTimerCompleted(sessionType);
      } else {
        this.notificationManager?.notifyTimerStopped(sessionType);
      }

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
        
        if (this.timerManager) {
          this.sidebarView.updateControlButtons(this.timerManager.getState());
        }
      }

      await this.clearTimerState();
    } catch (error) {
      console.error("Failed to handle timer completion", error);
      new Notice("⚠️ Failed to complete timer session. Check console for details.", 8000);
    } finally {
      this._pendingSession = null;
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
      let needsSave = false;

      if (data?.pendingSession) {
        if (this.logManager) {
          try {
            await this.logManager.appendSession(data.pendingSession);
          } catch (e) {
            console.error("Failed to log pending session:", e);
          }
        }
        delete data.pendingSession;
        needsSave = true;
      }

      const persistedState: PersistedTimerState | null = data?.timerState || null;

      if (persistedState && persistedState.state.isRunning) {
        const hoursSinceClose = (Date.now() - persistedState.timestamp) / (1000 * 60 * 60);

        if (hoursSinceClose > 24) {
          const pState = persistedState.state;
          const elapsedSeconds = pState.totalSeconds - pState.remainingSeconds;
          const incompleteSession: SessionData = {
            date: new Date(persistedState.timestamp).toISOString().split('T')[0],
            startTime: pState.startTime
              ? new Date(pState.startTime).toTimeString().split(' ')[0]
              : "00:00:00",
            endTime: new Date(persistedState.timestamp).toTimeString().split(' ')[0],
            duration: Math.max(1, Math.floor(elapsedSeconds / 60)),
            taskName: pState.taskName,
            status: "incomplete",
            sessionType: pState.sessionType,
          };

          if (this.logManager) {
            await this.logManager.appendSession(incompleteSession);
          }

          delete data.timerState;
          needsSave = true;
        } else if (this.timerManager) {
          this.timerManager.loadPersistedState(persistedState.state);
          this.timerManager.resumeInterval();

          const remaining = this.timerManager.getRemainingTime();
          const timerState = this.timerManager.getState();

          if (this.sidebarView) {
            this.sidebarView.updateTimerDisplay(remaining, timerState.totalSeconds);
            this.sidebarView.updateProgress(remaining, timerState.totalSeconds);
            this.sidebarView.updateControlButtons(timerState);
            this.sidebarView.updateSessionUI(timerState.sessionType, timerState.taskName);
          }

          new Notice(`🔄 Timer restored: ${timerState.taskName}`, 5000);
          console.log("Timer restored:", timerState.taskName);
        }
      }

      if (needsSave) {
        await this.saveData(data);
      }
    } catch (error) {
      console.error("Failed to check incomplete session", error);
    }
  }

  // Save timer state for recovery
  private async saveTimerState(state: TimerState): Promise<void> {
    try {
      const data = await this.loadData();
      const startTimeStr = state.startTime
        ? (typeof state.startTime === "string" ? state.startTime : state.startTime.toISOString())
        : null;
      const pauseStartTimeStr = state.pauseStartTime
        ? (typeof state.pauseStartTime === "string" ? state.pauseStartTime : state.pauseStartTime.toISOString())
        : null;
      const persistedState: PersistedTimerState = {
        state: {
          ...state,
          startTime: startTimeStr,
          pauseStartTime: pauseStartTimeStr,
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
