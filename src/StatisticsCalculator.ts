import { SessionData, Statistics, PeriodStats } from "./types";

export class StatisticsCalculator {
  /**
   * Calculate statistics from session data
   * @param sessions Array of session data
   * @returns Statistics for today, this week, and this month
   */
  static calculate(sessions: SessionData[]): Statistics {
    const now = new Date();
    const startOfDay = this.getStartOfDay(now);
    const startOfWeek = this.getStartOfWeek(now);
    const startOfMonth = this.getStartOfMonth(now);

    // Filter completed sessions only
    const completedSessions = this.filterCompleted(sessions);

    // Calculate statistics for each period
    const todaySessions = this.filterByDate(completedSessions, startOfDay, now);
    const weekSessions = this.filterByDate(completedSessions, startOfWeek, now);
    const monthSessions = this.filterByDate(completedSessions, startOfMonth, now);

    return {
      today: {
        completedSessions: todaySessions.length,
        totalMinutes: this.sumDuration(todaySessions),
      },
      thisWeek: {
        completedSessions: weekSessions.length,
        totalMinutes: this.sumDuration(weekSessions),
      },
      thisMonth: {
        completedSessions: monthSessions.length,
        totalMinutes: this.sumDuration(monthSessions),
      },
    };
  }

  /**
   * Filter sessions by date range
   * @param sessions Array of sessions
   * @param startDate Start date (inclusive)
   * @param endDate End date (inclusive)
   * @returns Filtered sessions
   */
  static filterByDate(
    sessions: SessionData[],
    startDate: Date,
    endDate: Date
  ): SessionData[] {
    return sessions.filter((session) => {
      const sessionDate = new Date(session.date);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
  }

  /**
   * Filter only completed sessions
   * @param sessions Array of sessions
   * @returns Only sessions with status "completed"
   */
  static filterCompleted(sessions: SessionData[]): SessionData[] {
    return sessions.filter((session) => session.status === "completed");
  }

  /**
   * Sum duration of sessions
   * @param sessions Array of sessions
   * @returns Total duration in minutes
   */
  static sumDuration(sessions: SessionData[]): number {
    return sessions.reduce((sum, session) => sum + session.duration, 0);
  }

  /**
   * Get start of day (00:00:00)
   * @param date Reference date (defaults to now)
   * @returns Date at start of day
   */
  static getStartOfDay(date: Date = new Date()): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get start of week (Monday 00:00:00)
   * @param date Reference date (defaults to now)
   * @returns Date at start of week
   */
  static getStartOfWeek(date: Date = new Date()): Date {
    const result = new Date(date);
    const day = result.getDay();
    
    // Calculate days to subtract to get to Monday
    // Sunday is 0, Monday is 1, so we need to handle Sunday specially
    const daysToSubtract = day === 0 ? 6 : day - 1;
    
    result.setDate(result.getDate() - daysToSubtract);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get start of month (1st day 00:00:00)
   * @param date Reference date (defaults to now)
   * @returns Date at start of month
   */
  static getStartOfMonth(date: Date = new Date()): Date {
    const result = new Date(date);
    result.setDate(1);
    result.setHours(0, 0, 0, 0);
    return result;
  }
}
