// Shared validation utilities

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Validate task name
 * @param taskName Task name to validate
 * @returns Result with void on success or ValidationError on failure
 */
export function validateTaskName(taskName: string): Result<void, ValidationError> {
  const trimmed = taskName.trim();
  
  if (trimmed.length === 0) {
    return { ok: false, error: new ValidationError("Task name cannot be empty") };
  }
  
  if (taskName.length > 100) {
    return { ok: false, error: new ValidationError("Task name cannot exceed 100 characters") };
  }
  
  return { ok: true, value: undefined };
}

/**
 * Truncate task name to maximum length
 * @param taskName Task name to truncate
 * @param maxLength Maximum length (default 100)
 * @returns Truncated task name
 */
export function truncateTaskName(taskName: string, maxLength: number = 100): string {
  if (taskName.length <= maxLength) {
    return taskName;
  }
  return taskName.substring(0, maxLength);
}

/**
 * Validate and sanitize settings
 * @param settings Settings to validate
 * @returns Sanitized settings with valid values
 */
export function validateSettings(settings: {
  workDuration?: number;
  breakDuration?: number;
  soundEnabled?: boolean;
  logFilePath?: string;
}): {
  workDuration: number;
  breakDuration: number;
  soundEnabled: boolean;
  logFilePath: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  let workDuration = settings.workDuration ?? 25;
  let breakDuration = settings.breakDuration ?? 5;
  const soundEnabled = settings.soundEnabled ?? true;
  let logFilePath = settings.logFilePath ?? "pomodoro-log.md";

  // Validate work duration
  if (typeof workDuration !== 'number' || workDuration <= 0 || workDuration > 120) {
    warnings.push(`Invalid work duration (${workDuration}), using default (25 min)`);
    workDuration = 25;
  }

  // Validate break duration
  if (typeof breakDuration !== 'number' || breakDuration <= 0 || breakDuration > 60) {
    warnings.push(`Invalid break duration (${breakDuration}), using default (5 min)`);
    breakDuration = 5;
  }

  // Validate log file path
  if (typeof logFilePath !== 'string' || !logFilePath.endsWith('.md')) {
    warnings.push(`Invalid log file path (${logFilePath}), using default (pomodoro-log.md)`);
    logFilePath = "pomodoro-log.md";
  }

  return {
    workDuration,
    breakDuration,
    soundEnabled,
    logFilePath,
    warnings,
  };
}
