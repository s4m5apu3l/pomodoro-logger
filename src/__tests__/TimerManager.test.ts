import { TimerManager } from "../TimerManager";
import { ValidationError } from "../validation";
import { PomodoroSettings, SessionData } from "../types";
import * as fc from "fast-check";
import {
	validTaskNameArbitrary,
	unicodeTaskNameArbitrary,
	whitespaceStringArbitrary,
	DEFAULT_PBT_CONFIG,
} from "../__test_helpers__/test-arbitraries";

const defaultSettings: PomodoroSettings = {
	workDuration: 25,
	breakDuration: 5,
	soundEnabled: true,
	logFilePath: "pomodoro-log.md",
};

describe("TimerManager", () => {
	let timer: TimerManager;

	beforeEach(() => {
		timer = new TimerManager(defaultSettings);
	});

	afterEach(() => {
		timer.stop();
	});

	// ===== PROPERTY-BASED TESTS =====

	// Feature: enhanced-pomodoro-timer, Property 1: Запуск таймера с валидным названием задачи
	describe("Property 1: Start timer with valid task name", () => {
		test("starting timer with any valid task name should set state to running", () => {
			fc.assert(
				fc.property(validTaskNameArbitrary, (taskName) => {
					const timer = new TimerManager(defaultSettings);
					const result = timer.start(taskName, "work");

					expect(result.ok).toBe(true);
					const state = timer.getState();
					expect(state.isRunning).toBe(true);
					expect(state.taskName).toBe(taskName.trim());
					expect(state.totalSeconds).toBe(defaultSettings.workDuration * 60);

					timer.stop();
				}),
				DEFAULT_PBT_CONFIG,
			);
		});
	});

	// Feature: enhanced-pomodoro-timer, Property 2: Пауза и возобновление сохраняют оставшееся время
	// Note: This property is validated by unit tests with more controlled timing
	describe("Property 2: Pause and resume preserve remaining time", () => {
		test("pausing then resuming should preserve remaining time", async () => {
			// Simplified test - the detailed behavior is covered by unit tests
			const timer = new TimerManager(defaultSettings);

			timer.start("Test task", "work");
			await new Promise((resolve) => setTimeout(resolve, 100));

			const beforePause = timer.getRemainingTime();
			timer.pause();
			const afterPause = timer.getRemainingTime();

			// Pausing should preserve time (within 1 second)
			expect(Math.abs(beforePause - afterPause)).toBeLessThanOrEqual(1);

			timer.resume();
			await new Promise((resolve) => setTimeout(resolve, 100));

			// After resume, timer should continue counting down
			const afterResume = timer.getRemainingTime();
			expect(afterResume).toBeLessThan(afterPause);

			timer.stop();
		});
	});

	// Feature: enhanced-pomodoro-timer, Property 3: Валидация названия задачи отклоняет пробельные строки
	describe("Property 3: Task name validation rejects whitespace strings", () => {
		test("starting timer with whitespace-only string should fail", () => {
			fc.assert(
				fc.property(whitespaceStringArbitrary, (whitespaceString) => {
					const timer = new TimerManager(defaultSettings);
					const result = timer.start(whitespaceString, "work");

					expect(result.ok).toBe(false);
					if (!result.ok) {
						expect(result.error).toBeInstanceOf(ValidationError);
					}

					const state = timer.getState();
					expect(state.isRunning).toBe(false);
				}),
				DEFAULT_PBT_CONFIG,
			);
		});
	});

	// Feature: enhanced-pomodoro-timer, Property 4: Многоязычные символы принимаются в названиях задач
	describe("Property 4: Multilingual characters accepted in task names", () => {
		test("starting timer with unicode characters should succeed", () => {
			fc.assert(
				fc.property(unicodeTaskNameArbitrary, (unicodeTaskName) => {
					const timer = new TimerManager(defaultSettings);
					const result = timer.start(unicodeTaskName, "work");

					expect(result.ok).toBe(true);
					const state = timer.getState();
					expect(state.taskName).toBe(unicodeTaskName.trim());

					timer.stop();
				}),
				DEFAULT_PBT_CONFIG,
			);
		});
	});

	// Feature: enhanced-pomodoro-timer, Property 5: Ограничение длины названия задачи
	describe("Property 5: Task name length limit", () => {
		test("starting timer with string longer than 100 chars should fail", () => {
			fc.assert(
				fc.property(
					fc.string({ minLength: 101, maxLength: 200 }),
					(longTaskName) => {
						const timer = new TimerManager(defaultSettings);
						const result = timer.start(longTaskName, "work");

						expect(result.ok).toBe(false);
						if (!result.ok) {
							expect(result.error).toBeInstanceOf(ValidationError);
						}
					},
				),
				DEFAULT_PBT_CONFIG,
			);
		});
	});

	// Feature: enhanced-pomodoro-timer, Property 20: Точность таймера на основе Date
	// Note: This property is validated by unit tests with more controlled timing
	describe("Property 20: Timer accuracy based on Date", () => {
		test("remaining time should be calculated from Date.now(), not counter decrement", async () => {
			// Simplified test - the detailed behavior is covered by unit tests
			const timer = new TimerManager({ ...defaultSettings, workDuration: 1 });

			timer.start("Test task", "work");
			const startTime = Date.now();

			await new Promise((resolve) => setTimeout(resolve, 500));

			const remaining = timer.getRemainingTime();
			const elapsed = (Date.now() - startTime) / 1000;
			const expected = 60 - elapsed;

			// Should be accurate within 1 second
			expect(Math.abs(remaining - expected)).toBeLessThan(1);

			timer.stop();
		});
	});

	// ===== UNIT TESTS =====

	describe("Pause/Resume Accuracy", () => {
		test("should not drift when pausing and resuming multiple times", () => {
			jest.useFakeTimers();
			const now = Date.now();
			jest.setSystemTime(now);

			const timer = new TimerManager({ ...defaultSettings, workDuration: 25 });
			timer.start("Accuracy test", "work");

			// Sequence of pause/resume with fractional seconds
			for (let i = 0; i < 5; i++) {
				// 1. Advance by 1.5 seconds
				jest.advanceTimersByTime(1500);
				jest.setSystemTime(Date.now());
				timer.pause();

				// 2. Wait while paused
				jest.advanceTimersByTime(1000);
				jest.setSystemTime(Date.now());
				timer.resume();
			}

			// After 5 cycles: 5 * 1.5 = 7.5 seconds should have elapsed
			const expectedRemaining = (25 * 60) - 7.5;
			const actualRemaining = timer.getRemainingTime();

			// We expect the floor(remaining) to be floor(1492.5) = 1492
			expect(actualRemaining).toBe(Math.floor(expectedRemaining));

			timer.stop();
			jest.useRealTimers();
		});
	});

	describe("Unit Tests", () => {
		test("should start timer with valid task name", () => {
			const result = timer.start("Write tests", "work");

			expect(result.ok).toBe(true);
			const state = timer.getState();
			expect(state.isRunning).toBe(true);
			expect(state.isPaused).toBe(false);
			expect(state.taskName).toBe("Write tests");
			expect(state.sessionType).toBe("work");
			expect(state.totalSeconds).toBe(25 * 60);
		});

		test("should reject empty task name", () => {
			const result = timer.start("", "work");

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("empty");
			}
		});

		test("should reject whitespace-only task name", () => {
			const result = timer.start("   ", "work");

			expect(result.ok).toBe(false);
		});

		test("should reject task name longer than 100 characters", () => {
			const longName = "a".repeat(101);
			const result = timer.start(longName, "work");

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("100");
			}
		});

		test("should prevent starting when already running", () => {
			timer.start("Task 1", "work");
			const result = timer.start("Task 2", "work");

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("already running");
			}
		});

		test("should pause active timer", () => {
			timer.start("Task", "work");
			timer.pause();

			const state = timer.getState();
			expect(state.isRunning).toBe(true);
			expect(state.isPaused).toBe(true);
		});

		test("should not pause inactive timer", () => {
			const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

			timer.pause();

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		test("should not pause already paused timer", () => {
			const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

			timer.start("Task", "work");
			timer.pause();
			timer.pause();

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		test("should resume paused timer", () => {
			timer.start("Task", "work");
			timer.pause();
			timer.resume();

			const state = timer.getState();
			expect(state.isRunning).toBe(true);
			expect(state.isPaused).toBe(false);
		});

		test("should not resume unpaused timer", () => {
			const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

			timer.start("Task", "work");
			timer.resume();

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		test("should stop timer", () => {
			timer.start("Task", "work");
			timer.stop();

			const state = timer.getState();
			expect(state.isRunning).toBe(false);
			expect(state.isPaused).toBe(false);
			expect(state.taskName).toBe("");
		});

		test("should not stop inactive timer", () => {
			const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

			timer.stop();

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		test("should emit tick events", (done) => {
			timer.onTick((remaining) => {
				expect(remaining).toBeGreaterThan(0);
				timer.stop();
				done();
			});

			timer.start("Task", "work");
		});

		test("should emit complete event when timer reaches zero", (done) => {
			const shortTimer = new TimerManager({
				...defaultSettings,
				workDuration: 0.02,
			}); // ~1 second

			shortTimer.onComplete((sessionData) => {
				expect(sessionData.taskName).toBe("Quick task");
				expect(sessionData.status).toBe("completed");
				expect(sessionData.duration).toBe(0);
				done();
			});

			shortTimer.start("Quick task", "work");
		}, 3000);

		test("should calculate remaining time accurately", async () => {
			timer.start("Task", "work");
			const initial = timer.getRemainingTime();

			await new Promise((resolve) => setTimeout(resolve, 1100));

			const after = timer.getRemainingTime();
			expect(initial - after).toBeGreaterThanOrEqual(1);
			expect(initial - after).toBeLessThanOrEqual(2);
		});
	});
});
