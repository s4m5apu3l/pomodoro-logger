import { NotificationManager, Notice } from "../NotificationManager";
import { NotificationSettings } from "../types";

// Mock Notice to capture messages
let capturedNotices: { message: string; duration?: number }[] = [];

// Override Notice constructor for testing
(global as any).Notice = class MockNotice {
	constructor(message: string, duration?: number) {
		capturedNotices.push({ message, duration });
	}
};

// Mock Web Audio API
const mockOscillator = {
	connect: jest.fn(),
	start: jest.fn(),
	stop: jest.fn(),
	frequency: { value: 0 },
	type: "sine" as OscillatorType,
};

const mockGainNode = {
	connect: jest.fn(),
	gain: {
		setValueAtTime: jest.fn(),
		exponentialRampToValueAtTime: jest.fn(),
	},
};

const mockAudioContext = {
	createOscillator: jest.fn(() => mockOscillator),
	createGain: jest.fn(() => mockGainNode),
	destination: {},
	currentTime: 0,
};

(global as any).AudioContext = jest.fn(() => mockAudioContext);
(global as any).window = {
	AudioContext: (global as any).AudioContext,
};

describe("NotificationManager", () => {
	let manager: NotificationManager;
	let settings: NotificationSettings;

	beforeEach(() => {
		capturedNotices = [];
		settings = { soundEnabled: true };
		manager = new NotificationManager(settings);

		// Reset mocks
		jest.clearAllMocks();
	});

	describe("notifyTimerStarted", () => {
		it("should show notification when timer starts", () => {
			manager.notifyTimerStarted("Write docs", 25);

			expect(capturedNotices).toHaveLength(1);
			expect(capturedNotices[0].message).toContain("Timer started");
			expect(capturedNotices[0].message).toContain("Write docs");
			expect(capturedNotices[0].message).toContain("25 min");
		});

		it("should include task name and duration in message", () => {
			manager.notifyTimerStarted("Code review", 15);

			expect(capturedNotices[0].message).toContain("Code review");
			expect(capturedNotices[0].message).toContain("15 min");
		});
	});

	describe("notifyTimerPaused", () => {
		it("should show notification when timer is paused", () => {
			manager.notifyTimerPaused(300); // 5 minutes

			expect(capturedNotices).toHaveLength(1);
			expect(capturedNotices[0].message).toContain("paused");
			expect(capturedNotices[0].message).toContain("5:00");
		});

		it("should format remaining time correctly", () => {
			manager.notifyTimerPaused(125); // 2 minutes 5 seconds

			expect(capturedNotices[0].message).toContain("2:05");
		});

		it("should pad seconds with zero", () => {
			manager.notifyTimerPaused(63); // 1 minute 3 seconds

			expect(capturedNotices[0].message).toContain("1:03");
		});
	});

	describe("notifyTimerCompleted", () => {
		it("should show notification when work session completes", () => {
			manager.notifyTimerCompleted("work");

			expect(capturedNotices).toHaveLength(1);
			expect(capturedNotices[0].message).toContain("Work session completed");
		});

		it("should show notification when break completes", () => {
			manager.notifyTimerCompleted("break");

			expect(capturedNotices).toHaveLength(1);
			expect(capturedNotices[0].message).toContain("Break completed");
		});

		it("should play sound when soundEnabled is true", () => {
			manager.notifyTimerCompleted("work");

			expect(mockAudioContext.createOscillator).toHaveBeenCalled();
			expect(mockAudioContext.createGain).toHaveBeenCalled();
			expect(mockOscillator.start).toHaveBeenCalled();
			expect(mockOscillator.stop).toHaveBeenCalled();
		});

		it("should not play sound when soundEnabled is false", () => {
			manager.setSoundEnabled(false);
			manager.notifyTimerCompleted("work");

			expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
		});
	});

	describe("notifyIncompleteSession", () => {
		it("should show notification about incomplete session", () => {
			manager.notifyIncompleteSession("Write docs", 900); // 15 minutes

			expect(capturedNotices).toHaveLength(1);
			expect(capturedNotices[0].message).toContain("Incomplete session");
			expect(capturedNotices[0].message).toContain("Write docs");
			expect(capturedNotices[0].message).toContain("15:00");
		});

		it("should show notification for longer duration (10 seconds)", () => {
			manager.notifyIncompleteSession("Code review", 300);

			expect(capturedNotices[0].duration).toBe(10000);
		});

		it("should include task name and remaining time", () => {
			manager.notifyIncompleteSession("Testing", 125); // 2:05

			expect(capturedNotices[0].message).toContain("Testing");
			expect(capturedNotices[0].message).toContain("2:05");
		});
	});

	describe("setSoundEnabled", () => {
		it("should enable sound notifications", () => {
			manager.setSoundEnabled(true);
			manager.notifyTimerCompleted("work");

			expect(mockAudioContext.createOscillator).toHaveBeenCalled();
		});

		it("should disable sound notifications", () => {
			manager.setSoundEnabled(false);
			manager.notifyTimerCompleted("work");

			expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
		});

		it("should toggle sound setting", () => {
			manager.setSoundEnabled(false);
			manager.notifyTimerCompleted("work");
			expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();

			jest.clearAllMocks();

			manager.setSoundEnabled(true);
			manager.notifyTimerCompleted("work");
			expect(mockAudioContext.createOscillator).toHaveBeenCalled();
		});
	});

	describe("sound playback error handling", () => {
		it("should handle sound playback errors gracefully", () => {
			// Mock console.warn to verify error logging
			const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

			// Make createOscillator throw an error
			mockAudioContext.createOscillator.mockImplementationOnce(() => {
				throw new Error("Audio context error");
			});

			// Should not throw
			expect(() => {
				manager.notifyTimerCompleted("work");
			}).not.toThrow();

			// Should log warning
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"NotificationManager: Failed to play sound",
				expect.any(Error),
			);

			consoleWarnSpy.mockRestore();
		});
	});

	describe("message formatting", () => {
		it("should format time with leading zeros for seconds", () => {
			manager.notifyTimerPaused(5); // 0:05

			expect(capturedNotices[0].message).toContain("0:05");
		});

		it("should handle zero remaining time", () => {
			manager.notifyTimerPaused(0); // 0:00

			expect(capturedNotices[0].message).toContain("0:00");
		});

		it("should handle large remaining time", () => {
			manager.notifyTimerPaused(3661); // 61:01

			expect(capturedNotices[0].message).toContain("61:01");
		});
	});
});

// ===== PROPERTY-BASED TESTS =====

// Feature: enhanced-pomodoro-timer, Property 17: Условное воспроизведение звука
describe("Property 17: Conditional sound playback", () => {
	const fc = require("fast-check");

	test("sound should play if and only if soundEnabled is true", () => {
		fc.assert(
			fc.property(
				fc.boolean(),
				fc.constantFrom("work", "break"),
				(soundEnabled: boolean, sessionType: "work" | "break") => {
					// Reset mocks
					jest.clearAllMocks();

					// Create manager with specific sound setting
					const testManager = new NotificationManager({ soundEnabled });

					// Trigger completion notification
					testManager.notifyTimerCompleted(sessionType);

					// Verify sound playback matches soundEnabled setting
					if (soundEnabled) {
						expect(mockAudioContext.createOscillator).toHaveBeenCalled();
						expect(mockOscillator.start).toHaveBeenCalled();
					} else {
						expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
						expect(mockOscillator.start).not.toHaveBeenCalled();
					}
				},
			),
			{ numRuns: 100 },
		);
	});

	test("sound setting can be toggled and affects playback", () => {
		fc.assert(
			fc.property(
				fc.boolean(),
				fc.boolean(),
				(initialSetting: boolean, newSetting: boolean) => {
					// Reset mocks
					jest.clearAllMocks();

					// Create manager with initial setting
					const testManager = new NotificationManager({
						soundEnabled: initialSetting,
					});

					// Change setting
					testManager.setSoundEnabled(newSetting);

					// Trigger notification
					testManager.notifyTimerCompleted("work");

					// Verify sound playback matches NEW setting (not initial)
					if (newSetting) {
						expect(mockAudioContext.createOscillator).toHaveBeenCalled();
					} else {
						expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
					}
				},
			),
			{ numRuns: 100 },
		);
	});
});

// Feature: enhanced-pomodoro-timer, Property 19: Уведомление о незавершенной сессии содержит детали
describe("Property 19: Incomplete session notification contains details", () => {
	const fc = require("fast-check");
	const { validTaskNameArbitrary } = require("../__test_helpers__/test-arbitraries");

	test("incomplete session notification should contain task name and remaining time", () => {
		fc.assert(
			fc.property(
				validTaskNameArbitrary,
				fc.integer({ min: 1, max: 7200 }), // 1 second to 2 hours
				(taskName: string, remainingSeconds: number) => {
					// Reset captured notices
					capturedNotices = [];

					// Create fresh manager instance
					const testManager = new NotificationManager({ soundEnabled: true });

					// Trigger incomplete session notification
					testManager.notifyIncompleteSession(taskName, remainingSeconds);

					// Should have exactly one notification
					expect(capturedNotices).toHaveLength(1);

					const notification = capturedNotices[0];

					// Notification should contain task name
					expect(notification.message).toContain(taskName);

					// Notification should contain time information
					const minutes = Math.floor(remainingSeconds / 60);
					const seconds = remainingSeconds % 60;
					const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
					expect(notification.message).toContain(timeStr);

					// Notification should indicate it's incomplete
					expect(notification.message.toLowerCase()).toContain("incomplete");

					// Should have longer duration for visibility
					expect(notification.duration).toBe(10000);
				},
			),
			{ numRuns: 100 },
		);
	});
});
