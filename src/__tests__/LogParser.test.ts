import { LogParser } from "../LogParser";
import { SessionData } from "../types";
import * as fc from "fast-check";
import {
	sessionDataArbitrary,
	DEFAULT_PBT_CONFIG,
} from "../__test_helpers__/test-arbitraries";

describe("LogParser", () => {
	// ===== PROPERTY-BASED TESTS =====

	// Feature: enhanced-pomodoro-timer, Property 11: Round-trip парсинга журнала
	describe("Property 11: Round-trip parsing", () => {
		test("parsing then formatting then parsing produces equivalent record", () => {
			fc.assert(
				fc.property(sessionDataArbitrary, (session) => {
					const formatted = LogParser.formatSession(session);
					const parsed = LogParser.parseRow(formatted);

					expect(parsed).not.toBeNull();
					if (parsed) {
						expect(parsed.date).toBe(session.date);
						expect(parsed.startTime).toBe(session.startTime);
						expect(parsed.duration).toBe(session.duration);
						expect(parsed.taskName).toBe(session.taskName);
						expect(parsed.status).toBe(session.status);
					}
				}),
				DEFAULT_PBT_CONFIG,
			);
		});
	});

	// Feature: enhanced-pomodoro-timer, Property 12: Парсинг извлекает все поля
	describe("Property 12: Parsing extracts all fields", () => {
		test("parsing valid markdown row extracts all fields correctly", () => {
			fc.assert(
				fc.property(sessionDataArbitrary, (expected) => {
					const row = LogParser.formatSession(expected);
					const parsed = LogParser.parseRow(row);

					expect(parsed).not.toBeNull();
					if (parsed) {
						expect(parsed).toHaveProperty("date");
						expect(parsed).toHaveProperty("startTime");
						expect(parsed).toHaveProperty("duration");
						expect(parsed).toHaveProperty("taskName");
						expect(parsed).toHaveProperty("status");

						expect(parsed.date).toBe(expected.date);
						expect(parsed.startTime).toBe(expected.startTime);
						expect(parsed.duration).toBe(expected.duration);
						expect(parsed.taskName).toBe(expected.taskName);
						expect(parsed.status).toBe(expected.status);
					}
				}),
				DEFAULT_PBT_CONFIG,
			);
		});
	});

	// Feature: enhanced-pomodoro-timer, Property 13: Валидация формата журнала
	describe("Property 13: Format validation", () => {
		test("parser rejects strings not matching markdown table format", () => {
			fc.assert(
				fc.property(
					fc.string().filter((s) => !s.startsWith("|") || !s.endsWith("|")),
					(invalidRow) => {
						const parsed = LogParser.parseRow(invalidRow);
						expect(parsed).toBeNull();
					},
				),
				DEFAULT_PBT_CONFIG,
			);
		});
	});

	// ===== UNIT TESTS =====

	describe("Unit Tests", () => {
		test("should format header correctly", () => {
			const header = LogParser.formatHeader();

			expect(header).toContain("| Date");
			expect(header).toContain("| Start Time");
			expect(header).toContain("| Duration");
			expect(header).toContain("| Task Name");
			expect(header).toContain("| Status");
			expect(header).toContain("| ---");
		});

		test("should format session as markdown row", () => {
			const session: SessionData = {
				date: "2024-01-15",
				startTime: "09:30:00",
				duration: 25,
				taskName: "Write tests",
				status: "completed",
			};

			const row = LogParser.formatSession(session);

			expect(row).toBe(
				"| 2024-01-15 | 09:30:00 | 25 | Write tests | completed |",
			);
		});

		test("should escape pipe characters in task name", () => {
			const session: SessionData = {
				date: "2024-01-15",
				startTime: "09:30:00",
				duration: 25,
				taskName: "Task | with | pipes",
				status: "completed",
			};

			const row = LogParser.formatSession(session);

			expect(row).toContain("Task \\| with \\| pipes");
		});

		test("should parse valid markdown row", () => {
			const row = "| 2024-01-15 | 09:30:00 | 25 | Write tests | completed |";
			const parsed = LogParser.parseRow(row);

			expect(parsed).not.toBeNull();
			expect(parsed?.date).toBe("2024-01-15");
			expect(parsed?.startTime).toBe("09:30:00");
			expect(parsed?.duration).toBe(25);
			expect(parsed?.taskName).toBe("Write tests");
			expect(parsed?.status).toBe("completed");
		});

		test("should unescape pipe characters in task name", () => {
			const row =
				"| 2024-01-15 | 09:30:00 | 25 | Task \\| with \\| pipes | completed |";
			const parsed = LogParser.parseRow(row);

			expect(parsed).not.toBeNull();
			expect(parsed?.taskName).toBe("Task | with | pipes");
		});

		test("should return null for invalid row format", () => {
			const invalidRows = [
				"not a table row",
				"| missing | closing pipe",
				"missing opening pipe |",
				"| only | two | columns |",
			];

			invalidRows.forEach((row) => {
				expect(LogParser.parseRow(row)).toBeNull();
			});
		});

		test("should return null for invalid date format", () => {
			const row = "| 2024/01/15 | 09:30:00 | 25 | Task | completed |";
			expect(LogParser.parseRow(row)).toBeNull();
		});

		test("should return null for invalid time format", () => {
			const row = "| 2024-01-15 | 9:30:00 | 25 | Task | completed |";
			expect(LogParser.parseRow(row)).toBeNull();
		});

		test("should return null for invalid duration", () => {
			const invalidRows = [
				"| 2024-01-15 | 09:30:00 | abc | Task | completed |",
				"| 2024-01-15 | 09:30:00 | -5 | Task | completed |",
				"| 2024-01-15 | 09:30:00 | 0 | Task | completed |",
			];

			invalidRows.forEach((row) => {
				expect(LogParser.parseRow(row)).toBeNull();
			});
		});

		test("should return null for invalid status", () => {
			const row = "| 2024-01-15 | 09:30:00 | 25 | Task | invalid |";
			expect(LogParser.parseRow(row)).toBeNull();
		});

		test("should parse log file with multiple sessions", () => {
			const content = `| Date       | Start Time | Duration | Task Name        | Status     |
| ---------- | ---------- | -------- | ---------------- | ---------- |
| 2024-01-15 | 09:30:00   | 25       | Write docs       | completed  |
| 2024-01-15 | 10:00:00   | 5        | Break            | completed  |
| 2024-01-15 | 10:05:00   | 15       | Code review      | incomplete |`;

			const sessions = LogParser.parseLogFile(content);

			expect(sessions).toHaveLength(3);
			expect(sessions[0].taskName).toBe("Write docs");
			expect(sessions[1].taskName).toBe("Break");
			expect(sessions[2].taskName).toBe("Code review");
			expect(sessions[2].status).toBe("incomplete");
		});

		test("should skip invalid rows and continue parsing", () => {
			const content = `| Date       | Start Time | Duration | Task Name        | Status     |
| ---------- | ---------- | -------- | ---------------- | ---------- |
| 2024-01-15 | 09:30:00   | 25       | Valid task       | completed  |
invalid row here
| 2024-01-15 | 10:00:00   | 5        | Another valid    | completed  |`;

			const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

			const sessions = LogParser.parseLogFile(content);

			expect(sessions).toHaveLength(2);
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		test("should handle empty log file", () => {
			const sessions = LogParser.parseLogFile("");
			expect(sessions).toHaveLength(0);
		});

		test("should handle log file with only header", () => {
			const content = LogParser.formatHeader();
			const sessions = LogParser.parseLogFile(content);
			expect(sessions).toHaveLength(0);
		});
	});
});
