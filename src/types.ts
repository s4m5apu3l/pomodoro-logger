// Core data models for the Enhanced Pomodoro Timer

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  taskName: string;
  startTime: Date | null;
  sessionType: 'work' | 'break';
}

export interface SessionData {
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:MM:SS
  endTime: string;       // HH:MM:SS
  duration: number;      // in minutes
  taskName: string;
  status: 'completed' | 'incomplete';
  sessionType?: 'work' | 'break';
}

export interface PomodoroSettings {
  workDuration: number;      // minutes (default 25)
  breakDuration: number;     // minutes (default 5)
  soundEnabled: boolean;     // default true
  logFilePath: string;       // default "pomodoro-log.md"
}

export interface Statistics {
  today: PeriodStats;
  thisWeek: PeriodStats;
  thisMonth: PeriodStats;
}

export interface PeriodStats {
  completedSessions: number;
  totalMinutes: number;
}

export interface NotificationSettings {
  soundEnabled: boolean;
}

export const DEFAULT_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  breakDuration: 5,
  soundEnabled: true,
  logFilePath: "pomodoro-log.md",
};
