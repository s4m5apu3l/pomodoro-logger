import { SessionData } from "./types";
import { LogParser } from "./LogParser";
import { Result } from "./validation";

// Mock Vault interface for testing (will use real Obsidian Vault in production)
export interface VaultAdapter {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, data: string): Promise<void>;
}

// Error types for LogManager
export class LogError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LogError";
  }
}

export class LogManager {
  private logFilePath: string;
  private vault: VaultAdapter;

  constructor(vault: VaultAdapter, logFilePath: string) {
    this.vault = vault;
    this.logFilePath = logFilePath;
  }

  // Append a session to the log
  async appendSession(session: SessionData): Promise<Result<void, LogError>> {
    try {
      const ensureResult = await this.ensureLogFileExists();
      if (!ensureResult.ok) {
        return ensureResult;
      }
      
      const existing = await this.vault.read(this.logFilePath);
      const newRow = LogParser.formatSession(session);
      const content = existing.trimEnd() + "\n" + newRow + "\n";
      
      await this.vault.write(this.logFilePath, content);
      
      return { ok: true, value: undefined };
    } catch (error) {
      console.error("LogManager: Failed to append session", error);
      return { 
        ok: false, 
        error: new LogError("Failed to append session to log", error) 
      };
    }
  }

  // Read all sessions from the log
  async readAllSessions(): Promise<SessionData[]> {
    try {
      const exists = await this.vault.exists(this.logFilePath);
      
      if (!exists) {
        return [];
      }
      
      const content = await this.vault.read(this.logFilePath);
      return LogParser.parseLogFile(content);
    } catch (error) {
      console.error("LogManager: Failed to read sessions", error);
      return [];
    }
  }

  // Read sessions within a date range
  async readSessionsInRange(startDate: Date, endDate: Date): Promise<SessionData[]> {
    const allSessions = await this.readAllSessions();
    
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    return allSessions.filter(session => {
      return session.date >= startStr && session.date <= endStr;
    });
  }

  // Ensure log file exists with header
  private async ensureLogFileExists(): Promise<Result<void, LogError>> {
    try {
      const exists = await this.vault.exists(this.logFilePath);
      
      if (!exists) {
        const header = LogParser.formatHeader();
        await this.vault.write(this.logFilePath, header + "\n");
      }
      
      return { ok: true, value: undefined };
    } catch (error) {
      console.error("LogManager: Failed to create log file", error);
      return { 
        ok: false, 
        error: new LogError("Failed to create log file", error) 
      };
    }
  }
}
