import { StatisticsCalculator } from "../StatisticsCalculator";
import { SessionData } from "../types";

describe("StatisticsCalculator", () => {
	describe("calculate", () => {
		it("should return zero statistics for empty journal", () => {
			const stats = StatisticsCalculator.calculate([]);

			expect(stats.today.completedSessions).toBe(0);
			expect(stats.today.totalMinutes).toBe(0);
			expect(stats.thisWeek.completedSessions).toBe(0);
			expect(stats.thisWeek.totalMinutes).toBe(0);
			expect(stats.thisMonth.completedSessions).toBe(0);
			expect(stats.thisMonth.totalMinutes).toBe(0);
		});

		it("should calculate statistics for a single session today", () => {
			const today = new Date();
			const session: SessionData = {
				date: today.toISOString().split("T")[0],
				startTime: "09:00:00",
				endTime: "09:25:00",
				duration: 25,
				taskName: "Test task",
				status: "completed",
			};

			const stats = StatisticsCalculator.calculate([session]);

			expect(stats.today.completedSessions).toBe(1);
			expect(stats.today.totalMinutes).toBe(25);
			expect(stats.thisWeek.completedSessions).toBe(1);
			expect(stats.thisWeek.totalMinutes).toBe(25);
			expect(stats.thisMonth.completedSessions).toBe(1);
			expect(stats.thisMonth.totalMinutes).toBe(25);
		});

		it("should only count completed sessions", () => {
			const today = new Date();
			const dateStr = today.toISOString().split("T")[0];

			const sessions: SessionData[] = [
				{
					date: dateStr,
					startTime: "09:00:00",
					endTime: "09:25:00",
					duration: 25,
					taskName: "Completed task",
					status: "completed",
				},
				{
					date: dateStr,
				startTime: "10:00:00",
				endTime: "10:15:00",
				duration: 15,
					taskName: "Incomplete task",
					status: "incomplete",
				},
			];

			const stats = StatisticsCalculator.calculate(sessions);

			expect(stats.today.completedSessions).toBe(1);
			expect(stats.today.totalMinutes).toBe(25);
		});

		it("should filter sessions by date ranges correctly", () => {
			const today = new Date();
			const yesterday = new Date(today);
			yesterday.setDate(yesterday.getDate() - 1);

			const lastWeek = new Date(today);
			lastWeek.setDate(lastWeek.getDate() - 8);

			const lastMonth = new Date(today);
			lastMonth.setMonth(lastMonth.getMonth() - 1);

			const sessions: SessionData[] = [
				{
					date: today.toISOString().split("T")[0],
					startTime: "09:00:00",
					endTime: "09:25:00",
					duration: 25,
					taskName: "Today",
					status: "completed",
				},
				{
					date: yesterday.toISOString().split("T")[0],
					startTime: "09:00:00",
					endTime: "09:25:00",
					duration: 25,
					taskName: "Yesterday",
					status: "completed",
				},
				{
					date: lastWeek.toISOString().split("T")[0],
					startTime: "09:00:00",
					endTime: "09:25:00",
					duration: 25,
					taskName: "Last week",
					status: "completed",
				},
				{
					date: lastMonth.toISOString().split("T")[0],
					startTime: "09:00:00",
					endTime: "09:25:00",
					duration: 25,
					taskName: "Last month",
					status: "completed",
				},
			];

			const stats = StatisticsCalculator.calculate(sessions);

			expect(stats.today.completedSessions).toBe(1);
			expect(stats.today.totalMinutes).toBe(25);

			// This week should include today and yesterday (if yesterday is in current week)
			expect(stats.thisWeek.completedSessions).toBeGreaterThanOrEqual(1);

			// This month should include today, yesterday, and possibly last week
			expect(stats.thisMonth.completedSessions).toBeGreaterThanOrEqual(1);
		});
	});

	describe("filterByDate", () => {
		it("should filter sessions within date range", () => {
			const sessions: SessionData[] = [
				{
					date: "2024-01-15",
					startTime: "09:00:00",
					endTime: "09:25:00",
					duration: 25,
					taskName: "Task 1",
					status: "completed",
				},
				{
					date: "2024-01-16",
					startTime: "09:00:00",
					endTime: "09:25:00",
					duration: 25,
					taskName: "Task 2",
					status: "completed",
				},
				{
					date: "2024-01-17",
					startTime: "09:00:00",
					endTime: "09:25:00",
					duration: 25,
					taskName: "Task 3",
					status: "completed",
				},
			];

		const startDate = new Date(2024, 0, 15);
		const endDate = new Date(2024, 0, 16, 23, 59, 59);

			const filtered = StatisticsCalculator.filterByDate(
				sessions,
				startDate,
				endDate,
			);

			expect(filtered).toHaveLength(2);
			expect(filtered[0].date).toBe("2024-01-15");
			expect(filtered[1].date).toBe("2024-01-16");
		});

		it("should include boundary dates", () => {
			const sessions: SessionData[] = [
				{
					date: "2024-01-15",
					startTime: "09:00:00",
					endTime: "09:25:00",
					duration: 25,
					taskName: "Task 1",
					status: "completed",
				},
			];

		const startDate = new Date(2024, 0, 15);
		const endDate = new Date(2024, 0, 15, 23, 59, 59);

			const filtered = StatisticsCalculator.filterByDate(
				sessions,
				startDate,
				endDate,
			);

			expect(filtered).toHaveLength(1);
		});

		it("should return empty array when no sessions in range", () => {
			const sessions: SessionData[] = [
				{
					date: "2024-01-15",
					startTime: "09:00:00",
					endTime: "09:25:00",
					duration: 25,
					taskName: "Task 1",
					status: "completed",
				},
			];

			const startDate = new Date("2024-01-20");
			const endDate = new Date("2024-01-25");

			const filtered = StatisticsCalculator.filterByDate(
				sessions,
				startDate,
				endDate,
			);

			expect(filtered).toHaveLength(0);
		});
	});

	describe("filterCompleted", () => {
		it("should filter only completed sessions", () => {
			const sessions: SessionData[] = [
				{
					date: "2024-01-15",
					startTime: "09:00:00",
					endTime: "09:25:00",
					duration: 25,
					taskName: "Completed",
					status: "completed",
				},
				{
					date: "2024-01-15",
				startTime: "10:00:00",
				endTime: "10:15:00",
				duration: 15,
					taskName: "Incomplete",
					status: "incomplete",
				},
				{
					date: "2024-01-15",
				startTime: "11:00:00",
				endTime: "11:25:00",
				duration: 25,
					taskName: "Another completed",
					status: "completed",
				},
			];

			const completed = StatisticsCalculator.filterCompleted(sessions);

			expect(completed).toHaveLength(2);
			expect(completed[0].status).toBe("completed");
			expect(completed[1].status).toBe("completed");
		});

		it("should return empty array when no completed sessions", () => {
			const sessions: SessionData[] = [
				{
					date: "2024-01-15",
					startTime: "09:00:00",
					endTime: "09:25:00",
					duration: 25,
					taskName: "Incomplete",
					status: "incomplete",
				},
			];

			const completed = StatisticsCalculator.filterCompleted(sessions);

			expect(completed).toHaveLength(0);
		});
	});

	describe("sumDuration", () => {
		it("should sum duration of all sessions", () => {
			const sessions: SessionData[] = [
				{
					date: "2024-01-15",
					startTime: "09:00:00",
					endTime: "09:25:00",
					duration: 25,
					taskName: "Task 1",
					status: "completed",
				},
				{
					date: "2024-01-15",
				startTime: "10:00:00",
				endTime: "10:05:00",
				duration: 5,
					taskName: "Task 2",
					status: "completed",
				},
				{
					date: "2024-01-15",
				startTime: "11:00:00",
				endTime: "11:25:00",
				duration: 25,
					taskName: "Task 3",
					status: "completed",
				},
			];

			const total = StatisticsCalculator.sumDuration(sessions);

			expect(total).toBe(55);
		});

		it("should return 0 for empty array", () => {
			const total = StatisticsCalculator.sumDuration([]);

			expect(total).toBe(0);
		});
	});

	describe("getStartOfDay", () => {
		it("should return start of day (00:00:00)", () => {
			const date = new Date("2024-01-15T14:30:45.123");
			const startOfDay = StatisticsCalculator.getStartOfDay(date);

			expect(startOfDay.getFullYear()).toBe(2024);
			expect(startOfDay.getMonth()).toBe(0); // January
			expect(startOfDay.getDate()).toBe(15);
			expect(startOfDay.getHours()).toBe(0);
			expect(startOfDay.getMinutes()).toBe(0);
			expect(startOfDay.getSeconds()).toBe(0);
			expect(startOfDay.getMilliseconds()).toBe(0);
		});

		it("should handle midnight correctly", () => {
			const date = new Date("2024-01-15T00:00:00.000");
			const startOfDay = StatisticsCalculator.getStartOfDay(date);

			expect(startOfDay.getTime()).toBe(date.getTime());
		});
	});

	describe("getStartOfWeek", () => {
		it("should return Monday for a Tuesday", () => {
			// 2024-01-16 is a Tuesday
			const tuesday = new Date("2024-01-16T14:30:45.123");
			const startOfWeek = StatisticsCalculator.getStartOfWeek(tuesday);

			// Should be Monday 2024-01-15
			expect(startOfWeek.getFullYear()).toBe(2024);
			expect(startOfWeek.getMonth()).toBe(0);
			expect(startOfWeek.getDate()).toBe(15);
			expect(startOfWeek.getHours()).toBe(0);
			expect(startOfWeek.getMinutes()).toBe(0);
			expect(startOfWeek.getSeconds()).toBe(0);
			expect(startOfWeek.getMilliseconds()).toBe(0);
		});

		it("should return same Monday for a Monday", () => {
			// 2024-01-15 is a Monday
			const monday = new Date("2024-01-15T14:30:45.123");
			const startOfWeek = StatisticsCalculator.getStartOfWeek(monday);

			expect(startOfWeek.getFullYear()).toBe(2024);
			expect(startOfWeek.getMonth()).toBe(0);
			expect(startOfWeek.getDate()).toBe(15);
			expect(startOfWeek.getHours()).toBe(0);
		});

		it("should return previous Monday for a Sunday", () => {
			// 2024-01-21 is a Sunday
			const sunday = new Date("2024-01-21T14:30:45.123");
			const startOfWeek = StatisticsCalculator.getStartOfWeek(sunday);

			// Should be Monday 2024-01-15
			expect(startOfWeek.getFullYear()).toBe(2024);
			expect(startOfWeek.getMonth()).toBe(0);
			expect(startOfWeek.getDate()).toBe(15);
			expect(startOfWeek.getHours()).toBe(0);
		});
	});

	describe("getStartOfMonth", () => {
		it("should return first day of month (00:00:00)", () => {
			const date = new Date("2024-01-15T14:30:45.123");
			const startOfMonth = StatisticsCalculator.getStartOfMonth(date);

			expect(startOfMonth.getFullYear()).toBe(2024);
			expect(startOfMonth.getMonth()).toBe(0);
			expect(startOfMonth.getDate()).toBe(1);
			expect(startOfMonth.getHours()).toBe(0);
			expect(startOfMonth.getMinutes()).toBe(0);
			expect(startOfMonth.getSeconds()).toBe(0);
			expect(startOfMonth.getMilliseconds()).toBe(0);
		});

		it("should handle first day of month correctly", () => {
			const date = new Date("2024-01-01T14:30:45.123");
			const startOfMonth = StatisticsCalculator.getStartOfMonth(date);

			expect(startOfMonth.getDate()).toBe(1);
			expect(startOfMonth.getHours()).toBe(0);
		});

		it("should handle last day of month correctly", () => {
			const date = new Date("2024-01-31T23:59:59.999");
			const startOfMonth = StatisticsCalculator.getStartOfMonth(date);

			expect(startOfMonth.getFullYear()).toBe(2024);
			expect(startOfMonth.getMonth()).toBe(0);
			expect(startOfMonth.getDate()).toBe(1);
			expect(startOfMonth.getHours()).toBe(0);
		});
	});

	describe("boundary cases", () => {
		it("should handle sessions at midnight", () => {
			const sessions: SessionData[] = [
				{
					date: "2024-01-15",
				startTime: "00:00:00",
				endTime: "00:25:00",
				duration: 25,
					taskName: "Midnight task",
					status: "completed",
				},
			];

			const startDate = new Date("2024-01-15T00:00:00.000");
			const endDate = new Date("2024-01-15T23:59:59.999");

			const filtered = StatisticsCalculator.filterByDate(
				sessions,
				startDate,
				endDate,
			);

			expect(filtered).toHaveLength(1);
		});

		it("should handle start of week boundary", () => {
			// Monday 2024-01-15
			const monday = new Date("2024-01-15T00:00:00.000");
			const startOfWeek = StatisticsCalculator.getStartOfWeek(monday);

			expect(startOfWeek.getTime()).toBe(monday.getTime());
		});

		it("should handle start of month boundary", () => {
			const firstDay = new Date("2024-01-01T00:00:00.000");
			const startOfMonth = StatisticsCalculator.getStartOfMonth(firstDay);

			expect(startOfMonth.getTime()).toBe(firstDay.getTime());
		});
	});
});

// ===== PROPERTY-BASED TESTS =====

// Feature: enhanced-pomodoro-timer, Property 14: Статистика учитывает только завершенные сессии
describe("Property 14: Statistics only count completed sessions", () => {
	const fc = require("fast-check");
	const { sessionDataArbitrary } = require("../__test_helpers__/test-arbitraries");

	test("statistics should only include sessions with status 'completed'", () => {
		fc.assert(
			fc.property(
				fc.array(sessionDataArbitrary, { minLength: 1, maxLength: 50 }),
				(sessions: SessionData[]) => {
					const stats = StatisticsCalculator.calculate(sessions);

					// Count completed sessions manually
					const completedCount = sessions.filter(
						(s) => s.status === "completed",
					).length;

					// Total sessions in stats should never exceed completed sessions
					const totalStatsCount =
						stats.today.completedSessions +
						stats.thisWeek.completedSessions +
						stats.thisMonth.completedSessions;

					// Each period can only count completed sessions
					expect(stats.today.completedSessions).toBeLessThanOrEqual(
						completedCount,
					);
					expect(stats.thisWeek.completedSessions).toBeLessThanOrEqual(
						completedCount,
					);
					expect(stats.thisMonth.completedSessions).toBeLessThanOrEqual(
						completedCount,
					);

					// If there are no completed sessions, all stats should be zero
					if (completedCount === 0) {
						expect(stats.today.completedSessions).toBe(0);
						expect(stats.today.totalMinutes).toBe(0);
						expect(stats.thisWeek.completedSessions).toBe(0);
						expect(stats.thisWeek.totalMinutes).toBe(0);
						expect(stats.thisMonth.completedSessions).toBe(0);
						expect(stats.thisMonth.totalMinutes).toBe(0);
					}
				},
			),
			{ numRuns: 100 },
		);
	});
});

// Feature: enhanced-pomodoro-timer, Property 15: Подсчет сессий за период
describe("Property 15: Session counting per period", () => {
	const fc = require("fast-check");
	const { sessionDataArbitrary } = require("../__test_helpers__/test-arbitraries");

	test("session count should equal number of completed sessions in period", () => {
		fc.assert(
			fc.property(
				fc.array(sessionDataArbitrary, { minLength: 1, maxLength: 50 }),
				(sessions: SessionData[]) => {
					const stats = StatisticsCalculator.calculate(sessions);

					const now = new Date();
					const startOfDay = StatisticsCalculator.getStartOfDay(now);
					const startOfWeek = StatisticsCalculator.getStartOfWeek(now);
					const startOfMonth = StatisticsCalculator.getStartOfMonth(now);

					// Manually count completed sessions in each period
					const todaySessions = sessions.filter((s) => {
						const sessionDate = new Date(s.date);
						return (
							s.status === "completed" &&
							sessionDate >= startOfDay &&
							sessionDate <= now
						);
					});

					const weekSessions = sessions.filter((s) => {
						const sessionDate = new Date(s.date);
						return (
							s.status === "completed" &&
							sessionDate >= startOfWeek &&
							sessionDate <= now
						);
					});

					const monthSessions = sessions.filter((s) => {
						const sessionDate = new Date(s.date);
						return (
							s.status === "completed" &&
							sessionDate >= startOfMonth &&
							sessionDate <= now
						);
					});

					// Verify counts match
					expect(stats.today.completedSessions).toBe(todaySessions.length);
					expect(stats.thisWeek.completedSessions).toBe(weekSessions.length);
					expect(stats.thisMonth.completedSessions).toBe(monthSessions.length);
				},
			),
			{ numRuns: 100 },
		);
	});
});

// Feature: enhanced-pomodoro-timer, Property 16: Суммирование времени за период
describe("Property 16: Time summation per period", () => {
	const fc = require("fast-check");
	const { sessionDataArbitrary } = require("../__test_helpers__/test-arbitraries");

	test("total time should equal sum of durations in period", () => {
		fc.assert(
			fc.property(
				fc.array(sessionDataArbitrary, { minLength: 1, maxLength: 50 }),
				(sessions: SessionData[]) => {
					const stats = StatisticsCalculator.calculate(sessions);

					const now = new Date();
					const startOfDay = StatisticsCalculator.getStartOfDay(now);
					const startOfWeek = StatisticsCalculator.getStartOfWeek(now);
					const startOfMonth = StatisticsCalculator.getStartOfMonth(now);

					// Manually sum durations for each period
					const todayMinutes = sessions
						.filter((s) => {
							const sessionDate = new Date(s.date);
							return (
								s.status === "completed" &&
								sessionDate >= startOfDay &&
								sessionDate <= now
							);
						})
						.reduce((sum, s) => sum + s.duration, 0);

					const weekMinutes = sessions
						.filter((s) => {
							const sessionDate = new Date(s.date);
							return (
								s.status === "completed" &&
								sessionDate >= startOfWeek &&
								sessionDate <= now
							);
						})
						.reduce((sum, s) => sum + s.duration, 0);

					const monthMinutes = sessions
						.filter((s) => {
							const sessionDate = new Date(s.date);
							return (
								s.status === "completed" &&
								sessionDate >= startOfMonth &&
								sessionDate <= now
							);
						})
						.reduce((sum, s) => sum + s.duration, 0);

					// Verify sums match
					expect(stats.today.totalMinutes).toBe(todayMinutes);
					expect(stats.thisWeek.totalMinutes).toBe(weekMinutes);
					expect(stats.thisMonth.totalMinutes).toBe(monthMinutes);
				},
			),
			{ numRuns: 100 },
		);
	});
});
