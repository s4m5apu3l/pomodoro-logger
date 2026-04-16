import { PomodoroSettings, TimerState, SessionData } from "./types";
import { ValidationError, Result, validateTaskName } from "./validation";

export class TimerManager {
  private state: TimerState;
  private intervalId: number | null = null;
  private settings: PomodoroSettings;
  private tickCallbacks: Array<(remainingSeconds: number, totalSeconds: number) => void> = [];
  private completeCallbacks: Array<(sessionData: SessionData) => void> = [];
  private saveStateCallback: ((state: TimerState) => void) | null = null;

  constructor(settings: PomodoroSettings) {
    this.settings = settings;
    this.state = {
      isRunning: false,
      isPaused: false,
      remainingSeconds: 0,
      totalSeconds: 0,
      taskName: "",
      startTime: null,
      sessionType: "work",
    };
  }

  // Validate task name
  private validateTaskName(taskName: string): Result<void, ValidationError> {
    return validateTaskName(taskName);
  }

  // Start timer
  start(taskName: string, sessionType: 'work' | 'break' = 'work'): Result<void, ValidationError> {
    // Validate task name
    const validation = this.validateTaskName(taskName);
    if (!validation.ok) {
      return validation;
    }

    // Prevent starting if already running
    if (this.state.isRunning) {
      return { ok: false, error: new ValidationError("Timer is already running") };
    }

    // Initialize state
    const duration = sessionType === 'work' 
      ? this.settings.workDuration 
      : this.settings.breakDuration;
    
    this.state = {
      isRunning: true,
      isPaused: false,
      remainingSeconds: duration * 60,
      totalSeconds: duration * 60,
      taskName: taskName.trim(),
      startTime: new Date(),
      sessionType,
    };

    // Start interval for UI updates
    this.startInterval();
    
    // Immediately save state for persistence
    if (this.saveStateCallback) {
      const serializable = this.getSerializableState();
      this.saveStateCallback(serializable as TimerState);
    }
    
    return { ok: true, value: undefined };
  }

  // Pause timer
  pause(): void {
    if (!this.state.isRunning) {
      console.warn("Cannot pause: timer is not running");
      return;
    }
    
    if (this.state.isPaused) {
      console.warn("Cannot pause: timer is already paused");
      return;
    }

    this.state.isPaused = true;
    this.stopInterval();
    if (this.saveStateCallback) {
      const serializable = this.getSerializableState();
      this.saveStateCallback(serializable as TimerState);
    }
  }

  // Resume timer
  resume(): void {
    if (!this.state.isRunning) {
      console.warn("Cannot resume: timer is not running");
      return;
    }
    
    if (!this.state.isPaused) {
      console.warn("Cannot resume: timer is not paused");
      return;
    }

    // Adjust startTime to account for paused duration
    // Calculate how much time has elapsed before pause
    const elapsed = this.state.totalSeconds - this.state.remainingSeconds;
    this.state.startTime = new Date(Date.now() - elapsed * 1000);

    this.state.isPaused = false;
    this.startInterval();
  }

  // Stop timer — logs incomplete session via completeCallbacks
  stop(): SessionData | null {
    if (!this.state.isRunning) {
      console.warn("Cannot stop: timer is not running");
      return null;
    }

    this.stopInterval();

    const elapsedSeconds = this.state.totalSeconds - this.state.remainingSeconds;
    const sessionData: SessionData = {
      date: new Date().toISOString().split('T')[0],
      startTime: this.state.startTime 
        ? this.state.startTime.toTimeString().split(' ')[0]
        : "00:00:00",
      endTime: new Date().toTimeString().split(' ')[0],
      duration: Math.max(1, Math.floor(elapsedSeconds / 60)),
      taskName: this.state.taskName,
      status: "incomplete",
      sessionType: this.state.sessionType,
    };

    this.state = {
      isRunning: false,
      isPaused: false,
      remainingSeconds: 0,
      totalSeconds: 0,
      taskName: "",
      startTime: null,
      sessionType: "work",
    };

    this.completeCallbacks.forEach(cb => cb(sessionData));

    return sessionData;
  }

  // Force stop interval (for unload)
  stopInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Start interval for a restored timer (after loadPersistedState)
  resumeInterval(): void {
    if (this.state.isRunning && !this.state.isPaused) {
      this.startInterval();
    }
  }

  // Get current state
  getState(): TimerState {
    return { ...this.state };
  }

  // Get remaining time (calculated from Date)
  getRemainingTime(): number {
    if (!this.state.isRunning || this.state.isPaused || !this.state.startTime) {
      return this.state.remainingSeconds;
    }

    // Date-based calculation for accuracy
    const elapsed = (Date.now() - this.state.startTime.getTime()) / 1000;
    const remaining = Math.max(0, this.state.totalSeconds - elapsed);
    
    return Math.floor(remaining);
  }

  // Update settings (does not affect running timer)
  updateSettings(settings: PomodoroSettings): void {
    this.settings = settings;
  }

  // Register tick callback
  onTick(callback: (remainingSeconds: number, totalSeconds: number) => void): void {
    this.tickCallbacks.push(callback);
  }

  // Register complete callback
  onComplete(callback: (sessionData: SessionData) => void): void {
    this.completeCallbacks.push(callback);
  }

  // Register save state callback (for auto-save)
  onSaveState(callback: (state: Omit<TimerState, 'startTime'> & { startTime: string | null }) => void): void {
    this.saveStateCallback = callback as (state: TimerState) => void;
  }

  // Get serializable state (for persistence)
  getSerializableState(): Omit<TimerState, 'startTime'> & { startTime: string | null } {
    return {
      ...this.state,
      startTime: this.state.startTime ? this.state.startTime.toISOString() : null,
    };
  }

  // Load state from persistence
  loadPersistedState(serializedState: Omit<TimerState, 'startTime'> & { startTime: string | null }): void {
    this.state = {
      ...serializedState,
      startTime: serializedState.startTime ? new Date(serializedState.startTime) : null,
    };
  }

  // Private: Handle completion
  private startInterval(): void {
    let tickCount = 0;
    this.intervalId = window.setInterval(() => {
      if (this.state.isPaused) {
        return;
      }

      const remaining = this.getRemainingTime();
      this.state.remainingSeconds = remaining;

      // Emit tick event
      this.tickCallbacks.forEach(cb => cb(remaining, this.state.totalSeconds));

      // Auto-save state every 30 seconds
      tickCount++;
      if (tickCount >= 30 && this.saveStateCallback) {
        tickCount = 0;
        const serializable = this.getSerializableState();
        this.saveStateCallback(serializable as TimerState);
      }

      // Check if completed
      if (remaining <= 0) {
        this.handleComplete();
      }
    }, 1000);
  }

  // Private: Handle completion
  private handleComplete(): void {
    this.stopInterval();

    const sessionData: SessionData = {
      date: new Date().toISOString().split('T')[0],
      startTime: this.state.startTime 
        ? this.state.startTime.toTimeString().split(' ')[0]
        : "00:00:00",
      endTime: new Date().toTimeString().split(' ')[0],
      duration: Math.floor(this.state.totalSeconds / 60),
      taskName: this.state.taskName,
      status: "completed",
      sessionType: this.state.sessionType,
    };

    // Reset state
    this.state.isRunning = false;
    this.state.isPaused = false;

    // Emit complete event
    this.completeCallbacks.forEach(cb => cb(sessionData));
  }
}
