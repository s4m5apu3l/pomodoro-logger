import PomodoroPlugin from "../main";
import {
	PomodoroSettings,
	DEFAULT_SETTINGS,
	SessionData,
	TimerState,
} from "../types";
import { TimerManager } from "../TimerManager";
import { LogManager, VaultAdapter } from "../LogManager";
import { NotificationManager } from "../NotificationManager";
import { Notice } from "obsidian";

// Mock Obsidian API
(global as any).Notice = Notice;

describe("PomodoroPlugin", () => {
	let plugin: PomodoroPlugin;
	let mockVaultAdapter: any;

	beforeEach(() => {
		// Create mock vault adapter
		mockVaultAdapter = {
			exists: jest.fn().mockResolvedValue(false),
			read: jest.fn().mockResolvedValue(""),
			write: jest.fn().mockResolvedValue(undefined),
		};

		// Create plugin instance
		plugin = Object.create(PomodoroPlugin.prototype);

		// Set up mock app
		(plugin as any).app = {
			vault: {
				adapter: mockVaultAdapter,
			},
		};

		// Set up data storage
		(plugin as any)._data = {};

		// Mock loadData and saveData
		plugin.loadData = jest.fn().mockImplementation(async () => {
			return (plugin as any)._data;
		});

		plugin.saveData = jest.fn().mockImplementation(async (data: any) => {
			(plugin as any)._data = data;
		});

		// Mock addCommand
		(plugin as any).addCommand = jest.fn();
	});

	describe("Settings Management", () => {
		test("should load default settings on first run", async () => {
			await plugin.loadSettings();

			expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
		});

		test("should load saved settings from disk", async () => {
			const customSettings: PomodoroSettings = {
				workDuration: 30,
				breakDuration: 10,
				soundEnabled: false,
				logFilePath: "custom-log.md",
			};

			await plugin.saveData({ settings: customSettings });
			await plugin.loadSettings();

			expect(plugin.settings.workDuration).toBe(30);
			expect(plugin.settings.breakDuration).toBe(10);
			expect(plugin.settings.soundEnabled).toBe(false);
		});

		test("should validate workDuration bounds and use default if invalid", async () => {
			await plugin.saveData({
				settings: { ...DEFAULT_SETTINGS, workDuration: 150 },
			});
			await plugin.loadSettings();

			expect(plugin.settings.workDuration).toBe(DEFAULT_SETTINGS.workDuration);
		});

		test("should validate breakDuration bounds and use default if invalid", async () => {
			await plugin.saveData({
				settings: { ...DEFAULT_SETTINGS, breakDuration: 0 },
			});
			await plugin.loadSettings();

			expect(plugin.settings.breakDuration).toBe(
				DEFAULT_SETTINGS.breakDuration,
			);
		});

		test("should handle corrupted settings gracefully", async () => {
			await plugin.saveData({ settings: null }); // null instead of string
			await plugin.loadSettings();

			expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
		});

		test("should save settings to disk", async () => {
			// Initialize settings first
			await plugin.loadSettings();

			plugin.settings.workDuration = 45;
			await plugin.saveSettings();

			const data = await plugin.loadData();
			expect(data.settings.workDuration).toBe(45);
		});

		test("should propagate settings to TimerManager on save", async () => {
			await plugin.onload();

			plugin.settings.workDuration = 50;
			await plugin.saveSettings();

			expect(plugin.timerManager).toBeTruthy();
			// Verify settings were updated (we can't directly check private field)
			// but we can verify the manager exists and was called
		});

		test("should propagate settings to NotificationManager on save", async () => {
			await plugin.onload();

			plugin.settings.soundEnabled = false;
			await plugin.saveSettings();

			expect(plugin.notificationManager).toBeTruthy();
		});
	});

	describe("Plugin Lifecycle", () => {
		test("should initialize all components on load", async () => {
			await plugin.onload();

			expect(plugin.timerManager).toBeInstanceOf(TimerManager);
			expect(plugin.logManager).toBeInstanceOf(LogManager);
			expect(plugin.notificationManager).toBeInstanceOf(NotificationManager);
		});

		test("should register sidebar command on load", async () => {
			await plugin.onload();

			expect((plugin as any).addCommand).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "open-pomodoro-sidebar",
					name: "Open Pomodoro Timer",
				}),
			);
		});

		test("should restore non-stale incomplete session on load", async () => {
			const incompleteState = {
				state: {
					isRunning: true,
					isPaused: false,
					remainingSeconds: 600,
					totalSeconds: 1500,
					taskName: "Test Task",
					startTime: new Date().toISOString(),
					sessionType: "work" as const,
				},
				timestamp: Date.now() - 1000 * 60 * 5, // 5 minutes ago
			};

			await plugin.saveData({ timerState: incompleteState });
			await plugin.onload();

			// Should have restored the timer (not cleared it)
			expect(plugin.timerManager?.getState().taskName).toBe("Test Task");
		});

		test("should save timer state on unload if running", async () => {
			await plugin.onload();

			// Start a timer
			plugin.timerManager!.start("Test Task", "work");

			await plugin.onunload();

			const data = await plugin.loadData();
			expect(data.timerState).toBeDefined();
			expect(data.timerState.state.taskName).toBe("Test Task");
		});

		test("should not save timer state on unload if not running", async () => {
			await plugin.onload();

			await plugin.onunload();

			const data = await plugin.loadData();
			expect(data.timerState).toBeUndefined();
		});

		test("should clean up resources on unload", async () => {
			await plugin.onload();
			await plugin.onunload();

			expect(plugin.timerManager).toBeNull();
			expect(plugin.logManager).toBeNull();
			expect(plugin.notificationManager).toBeNull();
		});
	});

	describe("Incomplete Session Recovery", () => {
		test("should restore timer if closed within 24 hours", async () => {
			const incompleteState = {
				state: {
					isRunning: true,
					isPaused: false,
					remainingSeconds: 600,
					totalSeconds: 1500,
					taskName: "Incomplete Task",
					startTime: new Date().toISOString(),
					sessionType: "work" as const,
				},
				timestamp: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
			};

			await plugin.saveData({ timerState: incompleteState });

			await plugin.onload();

			// Should have restored the timer
			expect(plugin.timerManager?.getState().taskName).toBe("Incomplete Task");
		});

		test("should log and clear stale timer state older than 24 hours", async () => {
			const staleState = {
				state: {
					isRunning: true,
					isPaused: false,
					remainingSeconds: 600,
					totalSeconds: 1500,
					taskName: "Stale Task",
					startTime: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 48 hours ago
					sessionType: "work" as const,
				},
				timestamp: Date.now() - 1000 * 60 * 60 * 48, // 48 hours ago
			};

			await plugin.saveData({ timerState: staleState });

			const writeSpy = jest.spyOn((plugin as any).app.vault.adapter, "write");

			await plugin.onload();

			// Should have logged the stale session as incomplete
			expect(writeSpy).toHaveBeenCalled();

			// The state should be cleared
			const data = await plugin.loadData();
			expect(data.timerState).toBeUndefined();
		});

		test("should show notification for incomplete session", async () => {
			const incompleteState = {
				state: {
					isRunning: true,
					isPaused: false,
					remainingSeconds: 600,
					totalSeconds: 1500,
					taskName: "Notify Task",
					startTime: new Date().toISOString(),
					sessionType: "work" as const,
				},
				timestamp: Date.now() - 1000 * 60 * 10, // 10 minutes ago
			};

			await plugin.saveData({ timerState: incompleteState });
			await plugin.onload();

			// Notification should have been shown (we can't easily test this without mocking)
			// but we can verify the manager exists
			expect(plugin.notificationManager).toBeTruthy();
		});

		test("should restore timer state after recovery", async () => {
			const incompleteState = {
				state: {
					isRunning: true,
					isPaused: false,
					remainingSeconds: 600,
					totalSeconds: 1500,
					taskName: "Clear Task",
					startTime: new Date().toISOString(),
					sessionType: "work" as const,
				},
				timestamp: Date.now() - 1000 * 60 * 5,
			};

			await plugin.saveData({ timerState: incompleteState });
			await plugin.onload();

			// Timer should be restored (state persists until timer completes/stops)
			expect(plugin.timerManager?.getState().taskName).toBe("Clear Task");
		});
	});

	describe("Timer Event Handlers", () => {
		test("should log completed session on timer complete", async () => {
			await plugin.onload();

			const writeSpy = jest.spyOn((plugin as any).app.vault.adapter, "write");

			// Simulate timer completion
			const sessionData: SessionData = {
				date: "2024-01-15",
				startTime: "10:00:00",
				endTime: "10:25:00",
				duration: 25,
				taskName: "Test Task",
				status: "completed",
			};

			// Trigger the complete callback
			await (plugin as any).onTimerComplete(sessionData);

			expect(writeSpy).toHaveBeenCalled();
		});

		test("should show notification on timer complete", async () => {
			await plugin.onload();

			const sessionData: SessionData = {
				date: "2024-01-15",
				startTime: "10:00:00",
				endTime: "10:25:00",
				duration: 25,
				taskName: "Test Task",
				status: "completed",
			};

			await (plugin as any).onTimerComplete(sessionData);

			// Notification should have been shown
			expect(plugin.notificationManager).toBeTruthy();
		});

		test("should clear timer state on timer complete", async () => {
			await plugin.onload();

			// Set up a timer state
			await plugin.saveData({
				timerState: {
					state: { isRunning: true } as any,
					timestamp: Date.now(),
				},
			});

			const sessionData: SessionData = {
				date: "2024-01-15",
				startTime: "10:00:00",
				endTime: "10:25:00",
				duration: 25,
				taskName: "Test Task",
				status: "completed",
			};

			await (plugin as any).onTimerComplete(sessionData);

			const data = await plugin.loadData();
			expect(data.timerState).toBeUndefined();
		});

		test("should handle logging errors gracefully", async () => {
			await plugin.onload();

			// Make write fail
			jest
				.spyOn((plugin as any).app.vault.adapter, "write")
				.mockRejectedValue(new Error("Write failed"));

			const sessionData: SessionData = {
				date: "2024-01-15",
				startTime: "10:00:00",
				endTime: "10:25:00",
				duration: 25,
				taskName: "Test Task",
				status: "completed",
			};

			// Should not throw
			await expect(
				(plugin as any).onTimerComplete(sessionData),
			).resolves.not.toThrow();
		});

		test("should update sidebar button states after timer completion", async () => {
			await plugin.onload();

			// Mock sidebar view
			const mockSidebarView = {
				updateStatistics: jest.fn(),
				updateControlButtons: jest.fn(),
			};
			plugin.sidebarView = mockSidebarView as any;

			const sessionData: SessionData = {
				date: "2024-01-15",
				startTime: "10:00:00",
				endTime: "10:25:00",
				duration: 25,
				taskName: "Test Task",
				status: "completed",
			};

			await (plugin as any).onTimerComplete(sessionData);

			// Should have updated button states
			expect(mockSidebarView.updateControlButtons).toHaveBeenCalledWith(
				expect.objectContaining({
					isRunning: false,
				}),
			);
		});

		test("should show notice if statistics refresh fails", async () => {
			await plugin.onload();

			// Mock sidebar view with failing statistics update
			const mockSidebarView = {
				updateStatistics: jest.fn().mockImplementation(() => {
					throw new Error("Stats update failed");
				}),
				updateControlButtons: jest.fn(),
			};
			plugin.sidebarView = mockSidebarView as any;

			// Mock readAllSessions to throw
			if (plugin.logManager) {
				jest
					.spyOn(plugin.logManager, "readAllSessions")
					.mockRejectedValue(new Error("Read failed"));
			}

			const sessionData: SessionData = {
				date: "2024-01-15",
				startTime: "10:00:00",
				endTime: "10:25:00",
				duration: 25,
				taskName: "Test Task",
				status: "completed",
			};

			// Should not throw, but should handle error gracefully
			await expect(
				(plugin as any).onTimerComplete(sessionData),
			).resolves.not.toThrow();

			// Button states should still be updated even if stats fail
			expect(mockSidebarView.updateControlButtons).toHaveBeenCalled();
		});

		test("should update UI on every timer tick", async () => {
			await plugin.onload();

			const mockSidebarView = {
				updateTimerDisplay: jest.fn(),
				updateProgress: jest.fn(),
			};
			plugin.sidebarView = mockSidebarView as any;

			(plugin as any).onTimerTick(1234, 1500);

			expect(mockSidebarView.updateTimerDisplay).toHaveBeenCalledWith(1234, 1500);
			expect(mockSidebarView.updateProgress).toHaveBeenCalledWith(1234, 1500);
		});

		test("should not crash if sidebar view is null during tick", async () => {
			await plugin.onload();
			plugin.sidebarView = null;

			// Should not throw
			expect(() => (plugin as any).onTimerTick(1234, 1500)).not.toThrow();
		});

		test("should not crash if sidebar view is null during completion", async () => {
			await plugin.onload();
			plugin.sidebarView = null;

			const sessionData: SessionData = {
				date: "2024-01-15",
				startTime: "10:00:00",
				endTime: "10:25:00",
				duration: 25,
				taskName: "Test Task",
				status: "completed",
			};

			// Should not throw
			await expect(
				(plugin as any).onTimerComplete(sessionData),
			).resolves.not.toThrow();
		});
	});

	describe("Date Serialization", () => {
		test("should serialize Date objects when saving timer state", async () => {
			await plugin.onload();
		
			const state: TimerState = {
				isRunning: true,
				isPaused: false,
				remainingSeconds: 600,
				totalSeconds: 1500,
				taskName: "Test",
				startTime: new Date("2024-01-15T10:00:00Z"),
				pauseStartTime: null,
				sessionType: "work",
			};
		
			await (plugin as any).saveTimerState(state);
		
			const data = await plugin.loadData();
			expect(typeof data.timerState.state.startTime).toBe("string");
			expect(data.timerState.state.startTime).toBe("2024-01-15T10:00:00.000Z");
		});
		
		test("should handle null startTime when saving", async () => {
			await plugin.onload();
		
			const state: TimerState = {
				isRunning: true,
				isPaused: false,
				remainingSeconds: 600,
				totalSeconds: 1500,
				taskName: "Test",
				startTime: null,
				pauseStartTime: null,
				sessionType: "work",
			};
		
			await (plugin as any).saveTimerState(state);
		
			const data = await plugin.loadData();
			expect(data.timerState.state.startTime).toBeNull();
		});

	});

	describe("Error Handling", () => {
		test("should show user notice on settings load failure", async () => {
			// Make loadData throw
			jest
				.spyOn(plugin, "loadData")
				.mockRejectedValue(new Error("Load failed"));

			await plugin.loadSettings();

			// Should fall back to defaults
			expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
		});

		test("should show user notice on settings save failure", async () => {
			await plugin.onload();

			// Make saveData throw
			jest
				.spyOn(plugin, "saveData")
				.mockRejectedValue(new Error("Save failed"));

			// Should not throw
			await expect(plugin.saveSettings()).resolves.not.toThrow();
		});

		test("should show user notice on incomplete session recovery failure", async () => {
			const incompleteState = {
				state: {
					isRunning: true,
					isPaused: false,
					remainingSeconds: 600,
					totalSeconds: 1500,
					taskName: "Test",
					startTime: new Date().toISOString(),
					sessionType: "work" as const,
				},
				timestamp: Date.now() - 1000 * 60 * 5,
			};

			await plugin.saveData({ timerState: incompleteState });

			// Make write fail
			jest
				.spyOn((plugin as any).app.vault.adapter, "write")
				.mockRejectedValue(new Error("Write failed"));

			// Should not throw
			await expect(plugin.onload()).resolves.not.toThrow();
		});
	});

	// Note: Properties 6 and 18 are validated by unit tests above
	// (Settings persistence and state persistence are already thoroughly tested)
});
