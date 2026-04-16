import { SessionData } from "./types";

export class LogParser {
  // Format header for Markdown table
  static formatHeader(): string {
    return [
      "| Date       | Start Time | End Time   | Duration | Task Name        | Status     |",
      "| ---------- | ---------- | ---------- | -------- | ---------------- | ---------- |",
    ].join("\n");
  }

  static formatSession(session: SessionData): string {
    const { date, startTime, endTime, duration, taskName, status } = session;
    
    const escapedTaskName = taskName.replace(/\|/g, "\\|");
    
    return `| ${date} | ${startTime} | ${endTime} | ${duration} | ${escapedTaskName} | ${status} |`;
  }

  // Parse entire log file content
  static parseLogFile(content: string): SessionData[] {
    const lines = content.split("\n");
    const sessions: SessionData[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines, header, and separator
      if (!line || line.startsWith("| Date") || line.startsWith("| ---")) {
        continue;
      }

      const session = this.parseRow(line);
      if (session) {
        sessions.push(session);
      } else {
        // Log warning for invalid rows
        console.warn(`LogParser: Skipping invalid row at line ${i + 1}: ${line}`);
      }
    }

    return sessions;
  }

  // Parse a single row
  static parseRow(row: string): SessionData | null {
    if (!this.isValidRow(row)) {
      return null;
    }

    const columns = this.extractColumns(row);
    
    if (columns.length !== 6) {
      return null;
    }

    const [date, startTime, endTime, durationStr, taskName, status] = columns;

    // Validate date format (YYYY-MM-DD, allow extended years like +010000-01-01)
    if (!/^[+-]?\d{4,6}-\d{2}-\d{2}$/.test(date)) {
      return null;
    }

    // Validate time format (HH:MM:SS)
    if (!/^\d{2}:\d{2}:\d{2}$/.test(startTime)) {
      return null;
    }

    if (!/^\d{2}:\d{2}:\d{2}$/.test(endTime)) {
      return null;
    }

    // Validate duration is a number
    const duration = parseInt(durationStr, 10);
    if (isNaN(duration) || duration <= 0) {
      return null;
    }

    // Validate status
    if (status !== "completed" && status !== "incomplete") {
      return null;
    }

    return {
      date,
      startTime,
      endTime,
      duration,
      taskName,
      status: status as "completed" | "incomplete",
    };
  }

  // Check if row is valid Markdown table row
  private static isValidRow(row: string): boolean {
    // Must start and end with |
    if (!row.startsWith("|") || !row.endsWith("|")) {
      return false;
    }

    // Must have at least 5 columns (6 pipes)
    const unescapedPipes = row.replace(/\\\|/g, '  ').match(/\|/g);
    const pipeCount = unescapedPipes ? unescapedPipes.length : 0;
    if (pipeCount < 7) {
      return false;
    }

    return true;
  }

  // Extract columns from a table row
  private static extractColumns(row: string): string[] {
    // Remove leading and trailing pipes
    const content = row.slice(1, -1);
    
    // Replace escaped pipes temporarily to avoid splitting on them
    const PIPE_PLACEHOLDER = "\x00PIPE\x00";
    const contentWithPlaceholders = content.replace(/\\\|/g, PIPE_PLACEHOLDER);
    
    // Split by pipe and trim each column
    const columns = contentWithPlaceholders.split("|").map(col => col.trim());
    
    // Restore escaped pipes
    return columns.map(col => col.replace(new RegExp(PIPE_PLACEHOLDER, 'g'), "|"));
  }
}
