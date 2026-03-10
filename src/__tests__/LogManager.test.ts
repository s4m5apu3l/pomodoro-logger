import { LogManager, VaultAdapter, LogError } from "../LogManager";
import { SessionData } from "../types";
import { LogParser } from "../LogParser";
import * as fc from "fast-check";
import {
	sessionDataArbitrary,
	sessionDataWithStatusArbitrary,
	DEFAULT_PBT_CONFIG,
} from "../__test_helpers__/test-arbitraries";

// Mock Vault implementation for testing
class MockVault implements VaultAdapter {
	private files: Map<string, string> = new Map();
	public shouldFailRead = false;
	public shouldFailWrite = false;

	async exists(path: string): Promise<boolean> {
		return this.files.has(path);
	}

	async read(path: string): Promise<string> {
		if (this.shouldFailRead) {
			throw new Error("Mock read error");
		}

		const content = this.files.get(path);
		if (content === undefined) {
			throw new Error(`File not found: ${path}`);
		}
		return content;
	}

	async write(path: string, data: string): Promise<void> {
		if (this.shouldFailWrite) {
			throw new Error("Mock write error");
		}

		this.files.set(path, data);
	}

	// Test helper
	clear() {
		this.files.clear();
		this.shouldFailRead = false;
		this.shouldFailWrite = false;
	}
}

describe("LogManager", () => {
	let vault: MockVault;
	let logManager: LogManager;
	const logPath = "test-log.md";

	beforeEach(() => {
		vault = new MockVault();
		logManager = new LogManager(vault, logPath);
	});

	afterEach(() => {
		vault.clear();
	});

	// ===== PROPERTY-BASED TESTS =====

	// Feature: enhanced-pomodoro-timer, Property 7: Логирование завершенных сессий со всеми полями
	describe("Property 7: Logging completed sessions with all fields", () => {
		test("appending completed session should include all fields", async () => {
			await fc.assert(
				fc.asyncProperty(
					sessionDataWithStatusArbitrary("completed"),
					async (session) => {
						const vault = new MockVault();
						const manager = new LogManager(vault, "test.md");

						await manager.appendSession(session);
						const sessions = await manager.readAllSessions();

						expect(sessions).toHaveLength(1);
						expect(sessions[0]).toMatchObject(session);
					},
				),
				DEFAULT_PBT_CONFIG,
			);
		});
	});

	// Feature: enhanced-pomodoro-timer, Property 8: Логирование незавершенных сессий
	describe("Property 8: Logging incomplete sessions", () => {
		test("appending incomplete session should include all fields and status", async () => {
			await fc.assert(
				fc.asyncProperty(
					sessionDataWithStatusArbitrary("incomplete"),
					async (session) => {
						const vault = new MockVault();
						const manager = new LogManager(vault, "test.md");

						await manager.appendSession(session);
						const sessions = await manager.readAllSessions();

						expect(sessions).toHaveLength(1);
						expect(sessions[0].status).toBe("incomplete");
						expect(sessions[0]).toMatchObject(session);
					},
				),
				DEFAULT_PBT_CONFIG,
			);
		});
	});

	// Feature: enhanced-pomodoro-timer, Property 9: Формат журнала как Markdown-таблица
	describe("Property 9: Log format as Markdown table", () => {
		test("log file should be formatted as markdown table", async () => {
			const session: SessionData = {
				date: "2024-01-15",
				startTime: "09:30:00",
				duration: 25,
				taskName: "Test",
				status: "completed",
			};

			await logManager.appendSession(session);
			const content = await vault.read(logPath);

			// Should have header
			expect(content).toContain("| Date");
			expect(content).toContain("| Start Time");
			expect(content).toContain("| Duration");
			expect(content).toContain("| Task Name");
			expect(content).toContain("| Status");
			expect(content).toContain("| ---");

			// Should have data row
			expect(content).toContain("| 2024-01-15");
			expect(content).toContain("| 09:30:00");
			expect(content).toContain("| 25");
			expect(content).toContain("| Test");
			expect(content).toContain("| completed");
		});
	});

	// Feature: enhanced-pomodoro-timer, Property 10: Добавление записей в конец журнала
	describe("Property 10: Appending records to end of log", () => {
		test("each new session should appear after all previous sessions", async () => {
			const sessions: SessionData[] = [
				{
					date: "2024-01-15",
					startTime: "09:00:00",
					duration: 25,
					taskName: "First",
					status: "completed",
				},
				{
					date: "2024-01-15",
					startTime: "10:00:00",
					duration: 25,
					taskName: "Second",
					status: "completed",
				},
				{
					date: "2024-01-15",
					startTime: "11:00:00",
					duration: 25,
					taskName: "Third",
					status: "completed",
				},
			];

			for (const session of sessions) {
				await logManager.appendSession(session);
			}

			const readSessions = await logManager.readAllSessions();

			expect(readSessions).toHaveLength(3);
			expect(readSessions[0].taskName).toBe("First");
			expect(readSessions[1].taskName).toBe("Second");
			expect(readSessions[2].taskName).toBe("Third");
		});
	});

	// ===== UNIT TESTS =====

	describe("Unit Tests", () => {
		test("should create log file on first append", async () => {
			const session: SessionData = {
				date: "2024-01-15",
				startTime: "09:30:00",
				duration: 25,
				taskName: "First session",
				status: "completed",
			};

			expect(await vault.exists(logPath)).toBe(false);

			await logManager.appendSession(session);

			expect(await vault.exists(logPath)).toBe(true);
		});

		test("should include header in new log file", async () => {
			const session: SessionData = {
				date: "2024-01-15",
				startTime: "09:30:00",
				duration: 25,
				taskName: "Test",
				status: "completed",
			};

			await logManager.appendSession(session);
			const content = await vault.read(logPath);

			expect(content).toContain(LogParser.formatHeader());
		});

		test("should append to existing log file", async () => {
			const session1: SessionData = {
				date: "2024-01-15",
				startTime: "09:00:00",
				duration: 25,
				taskName: "First",
				status: "completed",
			};

			const session2: SessionData = {
				date: "2024-01-15",
				startTime: "10:00:00",
				duration: 25,
				taskName: "Second",
				status: "completed",
			};

			await logManager.appendSession(session1);
			await logManager.appendSession(session2);

			const sessions = await logManager.readAllSessions();
			expect(sessions).toHaveLength(2);
		});

		test("should return empty array for non-existent log", async () => {
			const sessions = await logManager.readAllSessions();
			expect(sessions).toHaveLength(0);
		});

		test("should read all sessions from log", async () => {
			const testSessions: SessionData[] = [
				{
					date: "2024-01-15",
					startTime: "09:00:00",
					duration: 25,
					taskName: "Task 1",
					status: "completed",
				},
				{
					date: "2024-01-15",
					startTime: "10:00:00",
					duration: 5,
					taskName: "Break",
					status: "completed",
				},
				{
					date: "2024-01-15",
					startTime: "10:05:00",
					duration: 15,
					taskName: "Task 2",
					status: "incomplete",
				},
			];

			for (const session of testSessions) {
				await logManager.appendSession(session);
			}

			const sessions = await logManager.readAllSessions();

			expect(sessions).toHaveLength(3);
			expect(sessions[0].taskName).toBe("Task 1");
			expect(sessions[1].taskName).toBe("Break");
			expect(sessions[2].taskName).toBe("Task 2");
			expect(sessions[2].status).toBe("incomplete");
		});

		test("should filter sessions by date range", async () => {
			const sessions: SessionData[] = [
				{
					date: "2024-01-10",
					startTime: "09:00:00",
					duration: 25,
					taskName: "Old",
					status: "completed",
				},
				{
					date: "2024-01-15",
					startTime: "09:00:00",
					duration: 25,
					taskName: "In range 1",
					status: "completed",
				},
				{
					date: "2024-01-16",
					startTime: "09:00:00",
					duration: 25,
					taskName: "In range 2",
					status: "completed",
				},
				{
					date: "2024-01-20",
					startTime: "09:00:00",
					duration: 25,
					taskName: "Future",
					status: "completed",
				},
			];

			for (const session of sessions) {
				await logManager.appendSession(session);
			}

			const filtered = await logManager.readSessionsInRange(
				new Date("2024-01-15"),
				new Date("2024-01-16"),
			);

			expect(filtered).toHaveLength(2);
			expect(filtered[0].taskName).toBe("In range 1");
			expect(filtered[1].taskName).toBe("In range 2");
		});

		test("should handle read errors gracefully", async () => {
			vault.shouldFailRead = true;

			const sessions = await logManager.readAllSessions();

			expect(sessions).toHaveLength(0);
		});

		test("should return error on write failures", async () => {
			vault.shouldFailWrite = true;

			const session: SessionData = {
				date: "2024-01-15",
				startTime: "09:00:00",
				duration: 25,
				taskName: "Test",
				status: "completed",
			};

			const result = await logManager.appendSession(session);
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LogError);
				expect(result.error.message).toContain("Failed to");
			}
		});
	});
});
