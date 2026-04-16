import { NotificationSettings } from "./types";

// Notice class - will be provided by Obsidian in production
// In tests, this will be mocked
declare global {
  class Notice {
    constructor(message: string, duration?: number);
  }
}

// For TypeScript, export a type reference
export type { Notice };

export class NotificationManager {
  private settings: NotificationSettings;

  constructor(settings: NotificationSettings) {
    this.settings = settings;
  }

  /**
   * Notify when timer starts
   * @param taskName Name of the task
   * @param duration Duration in minutes
   */
  notifyTimerStarted(taskName: string, duration: number): void {
    const message = `⏱️ Timer started: "${taskName}" (${duration} min)`;
    this.showNotice(message);
  }

  /**
   * Notify when timer is paused
   * @param remainingTime Remaining time in seconds
   */
  notifyTimerPaused(remainingTime: number): void {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    const message = `⏸️ Timer paused (${timeStr} remaining)`;
    this.showNotice(message);
  }

  /**
   * Notify when timer completes
   * @param sessionType Type of session (work or break)
   */
  notifyTimerCompleted(sessionType: "work" | "break"): void {
    const message =
      sessionType === "work"
        ? "✅ Work session completed! Time for a break."
        : "✅ Break completed! Ready to work.";
    
    this.showNotice(message);
    
    if (this.settings.soundEnabled) {
      this.playSound();
    }
  }

  notifyTimerStopped(sessionType: "work" | "break"): void {
    const message =
      sessionType === "work"
        ? "⏹️ Work session stopped."
        : "⏹️ Break session stopped.";

    this.showNotice(message);
  }

  /**
   * Notify about incomplete session on startup
   * @param taskName Name of the task
   * @param remainingTime Remaining time in seconds
   */
  notifyIncompleteSession(taskName: string, remainingTime: number): void {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    const message = `⚠️ Incomplete session: "${taskName}" (${timeStr} remaining)`;
    this.showNotice(message, 10000); // Show for 10 seconds
  }

  /**
   * Enable or disable sound notifications
   * @param enabled Whether sound is enabled
   */
  setSoundEnabled(enabled: boolean): void {
    this.settings.soundEnabled = enabled;
  }

  /**
   * Update notification settings
   * @param settings New notification settings
   */
  updateSettings(settings: NotificationSettings): void {
    this.settings = settings;
  }

  /**
   * Play notification sound
   */
  private playSound(): void {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // 800 Hz tone
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.warn("NotificationManager: Failed to play sound", error);
    }
  }

  /**
   * Show a notice message
   * @param message Message to display
   * @param duration Duration in milliseconds (default 5000)
   */
  private showNotice(message: string, duration: number = 5000): void {
    new Notice(message, duration);
  }
}
