/**
 * Centralized fast-check arbitraries for property-based testing
 *
 * This module provides reusable generators for all data types used in the
 * Enhanced Pomodoro Timer plugin. All property-based tests should import
 * generators from this module to ensure consistency and avoid duplication.
 */

import * as fc from "fast-check";
import {
	SessionData,
	PomodoroSettings,
	TimerState,
	Statistics,
	PeriodStats,
} from "../types";

/**
 * Default configuration for property-based tests
 * All property tests should run at least 100 iterations
 */
export const DEFAULT_PBT_CONFIG = {
	numRuns: 100,
};

/**
 * Generates valid task names (1-100 characters, not only whitespace)
 *
 * Used for testing timer start operations with valid input.
 */
export const validTaskNameArbitrary = fc
	.string({ minLength: 1, maxLength: 100 })
	.filter((s) => s.trim().length > 0);

/**
 * Generates task names with Unicode/multilingual characters
 *
 * Used for testing that the system accepts international characters
 * in task names (Cyrillic, Chinese, emoji, etc.)
 */
export const unicodeTaskNameArbitrary = fc
	.fullUnicodeString({ minLength: 1, maxLength: 100 })
	.filter((s) => s.trim().length > 0);

/**
 * Generates strings containing only whitespace characters
 *
 * Used for testing validation that rejects whitespace-only task names.
 */
export const whitespaceStringArbitrary = fc
	.array(fc.constantFrom(" ", "\t", "\n"), { minLength: 1, maxLength: 10 })
	.map((arr) => arr.join(""));

/**
 * Generates valid SessionData objects
 *
 * Constraints:
 * - Date: within last 5 years (realistic range)
 * - Time: valid 24-hour format (HH:MM:SS)
 * - Duration: 1-120 minutes (reasonable session length)
 * - Task name: trimmed, 1-100 characters
 * - Status: completed or incomplete
 *
 * Note: Task names are trimmed because markdown table formatting trims them.
 */
export const sessionDataArbitrary: fc.Arbitrary<SessionData> = fc.record({
	date: fc
		.date({
			min: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
			max: new Date(),
		})
		.map((d) => d.toISOString().split("T")[0]),
	startTime: fc
		.tuple(
			fc.integer({ min: 0, max: 23 }),
			fc.integer({ min: 0, max: 59 }),
			fc.integer({ min: 0, max: 59 }),
		)
		.map(
			([h, m, s]) =>
				`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`,
		),
	duration: fc.integer({ min: 1, max: 120 }),
	taskName: fc
		.string({ minLength: 1, maxLength: 100 })
		.filter((s) => s.trim().length > 0)
		.map((s) => s.trim()),
	status: fc.constantFrom("completed" as const, "incomplete" as const),
});

/**
 * Generates valid PomodoroSettings objects
 *
 * Constraints:
 * - workDuration: 1-120 minutes
 * - breakDuration: 1-60 minutes
 * - soundEnabled: boolean
 * - logFilePath: always ends with .md
 */
export const settingsArbitrary: fc.Arbitrary<PomodoroSettings> = fc.record({
	workDuration: fc.integer({ min: 1, max: 120 }),
	breakDuration: fc.integer({ min: 1, max: 60 }),
	soundEnabled: fc.boolean(),
	logFilePath: fc
		.string({ minLength: 1, maxLength: 50 })
		.map((s) => s.replace(/[^a-zA-Z0-9-_]/g, "") || "log")
		.map((s) => `${s}.md`),
});

/**
 * Generates valid TimerState objects
 *
 * Constraints:
 * - Maintains invariants: isRunning && isPaused cannot both be true
 * - remainingSeconds <= totalSeconds
 * - taskName is non-empty if isRunning
 * - startTime is non-null if isRunning
 */
export const timerStateArbitrary: fc.Arbitrary<TimerState> = fc
	.tuple(
		fc.boolean(), // isRunning
		fc.boolean(), // isPaused
		fc.integer({ min: 0, max: 7200 }), // totalSeconds (up to 2 hours)
		validTaskNameArbitrary,
		fc.constantFrom("work" as const, "break" as const),
	)
	.chain(([isRunning, isPaused, totalSeconds, taskName, sessionType]) => {
		// Enforce invariants
		const validPaused = isRunning ? isPaused : false;
		const validTaskName = isRunning ? taskName : "";
		const validStartTime = isRunning ? new Date() : null;

		return fc.record({
			isRunning: fc.constant(isRunning),
			isPaused: fc.constant(validPaused),
			remainingSeconds: fc.integer({ min: 0, max: totalSeconds }),
			totalSeconds: fc.constant(totalSeconds),
			taskName: fc.constant(validTaskName),
			startTime: fc.constant(validStartTime),
			sessionType: fc.constant(sessionType),
		});
	});

/**
 * Generates valid PeriodStats objects
 *
 * Constraints:
 * - completedSessions >= 0
 * - totalMinutes >= 0
 * - If completedSessions is 0, totalMinutes should also be 0
 */
export const periodStatsArbitrary: fc.Arbitrary<PeriodStats> = fc
	.tuple(
		fc.integer({ min: 0, max: 1000 }), // completedSessions
		fc.integer({ min: 0, max: 100000 }), // totalMinutes
	)
	.map(([sessions, minutes]) => ({
		completedSessions: sessions,
		totalMinutes: sessions === 0 ? 0 : minutes,
	}));

/**
 * Generates valid Statistics objects
 *
 * Contains period stats for today, this week, and this month.
 */
export const statisticsArbitrary: fc.Arbitrary<Statistics> = fc.record({
	today: periodStatsArbitrary,
	thisWeek: periodStatsArbitrary,
	thisMonth: periodStatsArbitrary,
});

/**
 * Generates arrays of SessionData for testing statistics calculations
 *
 * @param minLength Minimum number of sessions
 * @param maxLength Maximum number of sessions
 */
export function sessionArrayArbitrary(
	minLength: number = 0,
	maxLength: number = 50,
): fc.Arbitrary<SessionData[]> {
	return fc.array(sessionDataArbitrary, { minLength, maxLength });
}

/**
 * Generates SessionData with specific status
 *
 * @param status The status to use for all generated sessions
 */
export function sessionDataWithStatusArbitrary(
	status: "completed" | "incomplete",
): fc.Arbitrary<SessionData> {
	return fc.record({
		date: fc
			.date({
				min: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
				max: new Date(),
			})
			.map((d) => d.toISOString().split("T")[0]),
		startTime: fc
			.tuple(
				fc.integer({ min: 0, max: 23 }),
				fc.integer({ min: 0, max: 59 }),
				fc.integer({ min: 0, max: 59 }),
			)
			.map(
				([h, m, s]) =>
					`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`,
			),
		duration: fc.integer({ min: 1, max: 120 }),
		taskName: fc
			.string({ minLength: 1, maxLength: 100 })
			.filter((s) => s.trim().length > 0)
			.map((s) => s.trim()),
		status: fc.constant(status),
	});
}
