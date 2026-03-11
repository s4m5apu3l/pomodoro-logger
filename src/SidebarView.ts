import { ItemView, WorkspaceLeaf, setIcon, Notice } from "obsidian";
import { Statistics, TimerState } from "./types";
import { validateTaskName, truncateTaskName } from "./validation";
import type PomodoroPlugin from "./main";

export const VIEW_TYPE_POMODORO = "pomodoro-timer-view";

export class SidebarView extends ItemView {
  private plugin: PomodoroPlugin;
  
  private timerContainer: HTMLElement | null = null;
  private sessionBadge: HTMLElement | null = null;
  private timerDisplay: HTMLElement | null = null;
  private timerTask: HTMLElement | null = null;
  private progressRing: SVGCircleElement | null = null;
  private taskNameInput: HTMLInputElement | null = null;
  private startButton: HTMLButtonElement | null = null;
  private pauseButton: HTMLButtonElement | null = null;
  private resumeButton: HTMLButtonElement | null = null;
  private stopButton: HTMLButtonElement | null = null;
  private workDurationInput: HTMLInputElement | null = null;
  private breakDurationInput: HTMLInputElement | null = null;
  private soundEnabledCheckbox: HTMLInputElement | null = null;
  private statisticsContainer: HTMLElement | null = null;
  private refreshStatsButton: HTMLButtonElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: PomodoroPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_POMODORO;
  }

  getDisplayText(): string {
    return "Pomodoro";
  }

  getIcon(): string {
    return "timer";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("pomodoro-sidebar");

    this.renderTimerSection(container);
    this.renderTaskSection(container);
    this.renderControlsSection(container);
    this.renderQuickActions(container);
    this.renderSettingsSection(container);
    this.renderStatisticsSection(container);

    await this.refreshStatistics();
    
    this.syncWithTimer();
  }

  async onClose(): Promise<void> {
  }

  private syncWithTimer(): void {
    if (this.plugin.timerManager) {
      const state = this.plugin.timerManager.getState();
      if (state.isRunning) {
        this.updateTimerDisplay(state.remainingSeconds, state.totalSeconds);
        this.updateProgress(state.remainingSeconds, state.totalSeconds);
        this.updateControlButtons(state);
        this.updateSessionUI(state.sessionType, state.taskName);
      }
    }
  }

  private renderTimerSection(container: Element): void {
    this.timerContainer = container.createDiv({ cls: "pmd-timer" });
    
    this.sessionBadge = this.timerContainer.createDiv({ cls: "pmd-badge pmd-badge--work" });
    this.sessionBadge.setText("focus");
    
    const progressContainer = this.timerContainer.createDiv({ cls: "pmd-ring-wrap" });
    
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "pmd-ring");
    svg.setAttribute("width", "200");
    svg.setAttribute("height", "200");
    svg.setAttribute("viewBox", "0 0 200 200");
    progressContainer.appendChild(svg);
    
    const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bgCircle.setAttribute("class", "pmd-ring__bg");
    bgCircle.setAttribute("cx", "100");
    bgCircle.setAttribute("cy", "100");
    bgCircle.setAttribute("r", "90");
    svg.appendChild(bgCircle);
    
    const circumference = 2 * Math.PI * 90;
    this.progressRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    this.progressRing.setAttribute("class", "pmd-ring__fill");
    this.progressRing.setAttribute("cx", "100");
    this.progressRing.setAttribute("cy", "100");
    this.progressRing.setAttribute("r", "90");
    this.progressRing.setAttribute("stroke-dasharray", circumference.toString());
    this.progressRing.setAttribute("stroke-dashoffset", "0");
    svg.appendChild(this.progressRing);
    
    const overlay = progressContainer.createDiv({ cls: "pmd-ring__overlay" });
    this.timerDisplay = overlay.createDiv({ cls: "pmd-time" });
    this.timerDisplay.setText("25:00");
    
    this.timerTask = this.timerContainer.createDiv({ cls: "pmd-task-label" });
    this.timerTask.setText("ready to focus");
  }

  private renderTaskSection(container: Element): void {
    const section = container.createDiv({ cls: "pmd-section" });
    section.createEl("label", { text: "What are you working on?", cls: "pmd-label" });
    
    this.taskNameInput = section.createEl("input", {
      type: "text",
      placeholder: "Enter task name...",
      cls: "pmd-input",
    }) as HTMLInputElement;
    
    this.taskNameInput.addEventListener("input", () => {
      if (this.taskNameInput) {
        if (this.taskNameInput.value.length > 100) {
          this.taskNameInput.value = truncateTaskName(this.taskNameInput.value);
        }
        const validation = validateTaskName(this.taskNameInput.value);
        if (validation.ok) {
          this.taskNameInput.removeClass("pmd-input--invalid");
        } else {
          this.taskNameInput.addClass("pmd-input--invalid");
        }
      }
    });
  }

  private renderControlsSection(container: Element): void {
    const section = container.createDiv({ cls: "pmd-controls" });
    
    this.startButton = section.createEl("button", {
      text: "start",
      cls: "pmd-btn pmd-btn--primary",
    }) as HTMLButtonElement;
    
    this.pauseButton = section.createEl("button", {
      text: "pause",
      cls: "pmd-btn pmd-btn--secondary",
    }) as HTMLButtonElement;
    
    this.resumeButton = section.createEl("button", {
      text: "resume",
      cls: "pmd-btn pmd-btn--primary",
    }) as HTMLButtonElement;
    
    this.stopButton = section.createEl("button", {
      text: "stop",
      cls: "pmd-btn pmd-btn--ghost",
    }) as HTMLButtonElement;
    
    this.startButton.addEventListener("click", () => this.handleStart());
    this.pauseButton.addEventListener("click", () => this.handlePause());
    this.resumeButton.addEventListener("click", () => this.handleResume());
    this.stopButton.addEventListener("click", () => this.handleStop());
    
    this.updateControlButtons(this.plugin.timerManager?.getState() || this.getDefaultState());
  }

  private renderQuickActions(container: Element): void {
    const section = container.createDiv({ cls: "pmd-section" });
    
    const header = section.createDiv({ cls: "pmd-section-header" });
    header.createEl("span", { text: "quick start", cls: "pmd-label" });
    
    const pillsContainer = section.createDiv({ cls: "pmd-pills" });
    
    const pomodoroBtn = pillsContainer.createEl("button", {
      text: "25m",
      cls: "pmd-pill pmd-pill--active",
      attr: { "data-duration": "25" }
    }) as HTMLButtonElement;
    
    const shortBtn = pillsContainer.createEl("button", {
      text: "15m",
      cls: "pmd-pill",
      attr: { "data-duration": "15" }
    }) as HTMLButtonElement;
    
    const longBtn = pillsContainer.createEl("button", {
      text: "45m",
      cls: "pmd-pill",
      attr: { "data-duration": "45" }
    }) as HTMLButtonElement;
    
    [pomodoroBtn, shortBtn, longBtn].forEach(btn => {
      btn.addEventListener("click", () => {
        const duration = parseInt(btn.getAttribute("data-duration") || "25", 10);
        this.plugin.settings.workDuration = duration;
        this.workDurationInput?.setAttribute("value", duration.toString());
        this.plugin.saveSettings();
        
        document.querySelectorAll(".pmd-pill").forEach(b => b.classList.remove("pmd-pill--active"));
        btn.classList.add("pmd-pill--active");
      });
    });
  }

  private renderSettingsSection(container: Element): void {
    const section = container.createDiv({ cls: "pmd-section" });
    
    const header = section.createDiv({ cls: "pmd-section-header" });
    header.createEl("span", { text: "settings", cls: "pmd-label" });
    
    const grid = section.createDiv({ cls: "pmd-settings-grid" });
    
    const workGroup = grid.createDiv({ cls: "pmd-field" });
    workGroup.createEl("label", { text: "work (min)", cls: "pmd-field__label" });
    this.workDurationInput = workGroup.createEl("input", {
      type: "number",
      value: this.plugin.settings.workDuration.toString(),
      cls: "pmd-field__input",
      attr: { min: "1", max: "120" },
    }) as HTMLInputElement;
    this.workDurationInput.addEventListener("change", () => this.handleSettingsChange());
    
    const breakGroup = grid.createDiv({ cls: "pmd-field" });
    breakGroup.createEl("label", { text: "break (min)", cls: "pmd-field__label" });
    this.breakDurationInput = breakGroup.createEl("input", {
      type: "number",
      value: this.plugin.settings.breakDuration.toString(),
      cls: "pmd-field__input",
      attr: { min: "1", max: "60" },
    }) as HTMLInputElement;
    this.breakDurationInput.addEventListener("change", () => this.handleSettingsChange());
    
    const soundGroup = section.createDiv({ cls: "pmd-toggle-row" });
    this.soundEnabledCheckbox = soundGroup.createEl("input", {
      type: "checkbox",
      cls: "pmd-toggle",
    }) as HTMLInputElement;
    this.soundEnabledCheckbox.checked = this.plugin.settings.soundEnabled;
    soundGroup.createEl("label", { text: "sound notifications", cls: "pmd-toggle-label" });
    this.soundEnabledCheckbox.addEventListener("change", () => this.handleSettingsChange());
  }

  private renderStatisticsSection(container: Element): void {
    const section = container.createDiv({ cls: "pmd-section pmd-section--stats" });
    
    const header = section.createDiv({ cls: "pmd-section-header" });
    header.createEl("span", { text: "statistics", cls: "pmd-label" });
    
    this.refreshStatsButton = header.createEl("button", {
      cls: "pmd-refresh",
      attr: { title: "Refresh statistics" },
    }) as HTMLButtonElement;
    setIcon(this.refreshStatsButton, "refresh-cw");
    this.refreshStatsButton.addEventListener("click", () => this.refreshStatistics());
    
    this.statisticsContainer = section.createDiv({ cls: "pmd-stats" });
  }

  private getDefaultState(): TimerState {
    return {
      isRunning: false,
      isPaused: false,
      remainingSeconds: this.plugin.settings.workDuration * 60,
      totalSeconds: this.plugin.settings.workDuration * 60,
      taskName: "",
      startTime: null,
      sessionType: "work",
    };
  }

  updateTimerDisplay(remainingSeconds: number, totalSeconds: number = 0): void {
    if (!this.timerDisplay) return;
    
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    this.timerDisplay.setText(timeString);
  }

  updateProgress(remaining: number, total: number): void {
    if (!this.progressRing) return;
    
    const circumference = 2 * Math.PI * 90;
    const progress = total > 0 ? remaining / total : 1;
    const offset = circumference * (1 - progress);
    this.progressRing.style.strokeDashoffset = offset.toString();
  }

  updateSessionUI(sessionType: 'work' | 'break', taskName: string): void {
    if (!this.sessionBadge || !this.timerContainer || !this.timerTask) return;
    
    if (sessionType === 'break') {
      this.timerContainer.classList.add('pmd-timer--break');
      this.sessionBadge.classList.remove('pmd-badge--work');
      this.sessionBadge.classList.add('pmd-badge--break');
      this.sessionBadge.setText("break");
      this.timerTask.setText("take a break");
    } else {
      this.timerContainer.classList.remove('pmd-timer--break');
      this.sessionBadge.classList.remove('pmd-badge--break');
      this.sessionBadge.classList.add('pmd-badge--work');
      this.sessionBadge.setText("focus");
      this.timerTask.setText(taskName || "ready to focus");
    }
  }

  updateControlButtons(state: TimerState): void {
    if (!this.startButton || !this.pauseButton || !this.resumeButton || !this.stopButton) {
      return;
    }
    
    this.setSettingsEnabled(!state.isRunning);
    
    if (state.isRunning && !state.isPaused) {
      this.timerContainer?.classList.add('pmd-timer--running');
      this.startButton.style.display = "none";
      this.pauseButton.style.display = "flex";
      this.resumeButton.style.display = "none";
      this.stopButton.style.display = "flex";
      this.pauseButton.disabled = false;
      this.stopButton.disabled = false;
    } else if (state.isRunning && state.isPaused) {
      this.timerContainer?.classList.remove('pmd-timer--running');
      this.startButton.style.display = "none";
      this.pauseButton.style.display = "flex";
      this.resumeButton.style.display = "flex";
      this.stopButton.style.display = "flex";
      this.pauseButton.disabled = true;
      this.resumeButton.disabled = false;
      this.stopButton.disabled = false;
    } else {
      this.timerContainer?.classList.remove('pmd-timer--running');
      this.startButton.style.display = "flex";
      this.pauseButton.style.display = "none";
      this.resumeButton.style.display = "none";
      this.stopButton.style.display = "none";
      this.startButton.disabled = false;
    }
    
    this.startButton.disabled = state.isRunning;
    this.stopButton.disabled = !state.isRunning;
  }

  updateStatistics(stats: Statistics): void {
    if (!this.statisticsContainer) return;
    
    this.statisticsContainer.empty();
    
    const periods = [
      { key: 'today', label: 'today' },
      { key: 'thisWeek', label: 'week' },
      { key: 'thisMonth', label: 'month' },
    ] as const;
    
    periods.forEach(period => {
      const statData = stats[period.key];
      const card = this.statisticsContainer!.createDiv({ cls: "pmd-stat" });
      
      card.createDiv({ cls: "pmd-stat__period", text: period.label });
      
      const valueDiv = card.createDiv({ cls: "pmd-stat__value" });
      valueDiv.setText(statData.completedSessions.toString());
      
      card.createDiv({ cls: "pmd-stat__unit", text: `${statData.totalMinutes}m` });
    });
  }

  private setSettingsEnabled(enabled: boolean): void {
    this.workDurationInput && (this.workDurationInput.disabled = !enabled);
    this.breakDurationInput && (this.breakDurationInput.disabled = !enabled);
  }

  private async refreshStatistics(): Promise<void> {
    if (!this.refreshStatsButton) return;
    this.refreshStatsButton.classList.add('pmd-refresh--spinning');
    
    try {
      if (!this.plugin.logManager) return;
      
      const sessions = await this.plugin.logManager.readAllSessions();
      const stats = await import("./StatisticsCalculator").then(m => 
        m.StatisticsCalculator.calculate(sessions)
      );
      
      this.updateStatistics(stats);
    } catch (error) {
      console.error("Failed to refresh statistics", error);
      this.updateStatistics({
        today: { completedSessions: 0, totalMinutes: 0 },
        thisWeek: { completedSessions: 0, totalMinutes: 0 },
        thisMonth: { completedSessions: 0, totalMinutes: 0 },
      });
    } finally {
      setTimeout(() => this.refreshStatsButton?.classList.remove('pmd-refresh--spinning'), 500);
    }
  }

  private handleStart(): void {
    if (!this.taskNameInput || !this.plugin.timerManager) return;
    
    const taskName = this.taskNameInput.value;
    const validation = validateTaskName(taskName);
    
    if (!validation.ok) {
      new Notice(`⚠️ ${validation.error.message}`, 3000);
      this.taskNameInput.addClass("pmd-input--invalid");
      return;
    }
    
    const result = this.plugin.timerManager.start(taskName, "work");
    
    if (!result.ok) {
      new Notice(`⚠️ ${result.error.message}`, 3000);
      return;
    }
    
    if (this.plugin.notificationManager) {
      this.plugin.notificationManager.notifyTimerStarted(taskName, this.plugin.settings.workDuration);
    }
    
    const state = this.plugin.timerManager.getState();
    this.updateControlButtons(state);
    this.updateTimerDisplay(state.remainingSeconds, state.totalSeconds);
    this.updateProgress(state.remainingSeconds, state.totalSeconds);
    this.updateSessionUI(state.sessionType, taskName);
  }

  private handlePause(): void {
    if (!this.plugin.timerManager) return;
    
    this.plugin.timerManager.pause();
    
    if (this.plugin.notificationManager) {
      this.plugin.notificationManager.notifyTimerPaused(this.plugin.timerManager.getRemainingTime());
    }
    
    const state = this.plugin.timerManager.getState();
    this.updateControlButtons(state);
    this.timerContainer?.classList.remove('pmd-timer--running');
  }

  private handleResume(): void {
    if (!this.plugin.timerManager) return;
    
    this.plugin.timerManager.resume();
    
    const state = this.plugin.timerManager.getState();
    this.updateControlButtons(state);
    this.timerContainer?.classList.add('pmd-timer--running');
  }

  private handleStop(): void {
    if (!this.plugin.timerManager) return;
    
    this.plugin.timerManager.stop();
    
    if (this.taskNameInput) {
      this.taskNameInput.value = "";
      this.taskNameInput.removeClass("pmd-input--invalid");
    }
    
    const state = this.plugin.timerManager.getState();
    const defaultState = this.getDefaultState();
    this.updateControlButtons(state);
    this.updateTimerDisplay(defaultState.remainingSeconds);
    this.updateProgress(defaultState.remainingSeconds, defaultState.totalSeconds);
    this.updateSessionUI('work', '');
    this.timerContainer?.classList.remove('pmd-timer--running', 'pmd-timer--break');
  }

  private async handleSettingsChange(): Promise<void> {
    if (!this.workDurationInput || !this.breakDurationInput || !this.soundEnabledCheckbox) return;
    
    try {
      const workDuration = parseInt(this.workDurationInput.value, 10);
      const breakDuration = parseInt(this.breakDurationInput.value, 10);
      
      if (isNaN(workDuration) || workDuration <= 0 || workDuration > 120) {
        new Notice("⚠️ Work: 1-120 min", 3000);
        this.workDurationInput.value = this.plugin.settings.workDuration.toString();
        return;
      }
      
      if (isNaN(breakDuration) || breakDuration <= 0 || breakDuration > 60) {
        new Notice("⚠️ Break: 1-60 min", 3000);
        this.breakDurationInput.value = this.plugin.settings.breakDuration.toString();
        return;
      }
      
      this.plugin.settings.workDuration = workDuration;
      this.plugin.settings.breakDuration = breakDuration;
      this.plugin.settings.soundEnabled = this.soundEnabledCheckbox.checked;
      
      await this.plugin.saveSettings();
      
      if (!this.plugin.timerManager?.getState().isRunning) {
        const defaultState = this.getDefaultState();
        this.updateTimerDisplay(defaultState.remainingSeconds);
        this.updateProgress(defaultState.remainingSeconds, defaultState.totalSeconds);
      }
    } catch (error) {
      console.error("Failed to save settings", error);
    }
  }
}
