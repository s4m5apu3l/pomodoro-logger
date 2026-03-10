import { TimerManager } from "../TimerManager";
import { PomodoroSettings } from "../types";

const defaultSettings: PomodoroSettings = {
	workDuration: 25,
	breakDuration: 5,
	soundEnabled: true,
	logFilePath: "pomodoro-log.md",
};

// Simple test to satisfy Jest
describe("Debug tests", () => {
	test("should pass", () => {
		expect(true).toBe(true);
	});
});

async function testPauseResume() {
	const taskName = "!";
	const workDuration = 2;

	const settings = { ...defaultSettings, workDuration };
	const timer = new TimerManager(settings);

	console.log("Starting timer with task:", taskName, "duration:", workDuration);
	const result = timer.start(taskName, "work");
	console.log("Start result:", result);

	if (!result.ok) {
		console.log("Failed to start");
		return;
	}

	// Wait a bit
	await new Promise((resolve) => setTimeout(resolve, 200));

	const beforePause = timer.getRemainingTime();
	console.log("Before pause:", beforePause);

	timer.pause();
	const afterPause = timer.getRemainingTime();
	console.log("After pause:", afterPause);
	console.log("Diff:", Math.abs(beforePause - afterPause));

	// Wait while paused
	await new Promise((resolve) => setTimeout(resolve, 100));

	timer.resume();
	console.log("Resumed");

	// Wait a tiny bit
	await new Promise((resolve) => setTimeout(resolve, 50));

	const afterResume = timer.getRemainingTime();
	console.log("After resume:", afterResume);
	console.log("Resume diff:", Math.abs(afterPause - afterResume));

	timer.stop();
}

async function testAccuracy() {
	const taskName = "!";
	const timer = new TimerManager({ ...defaultSettings, workDuration: 1 });

	console.log("\n=== Testing accuracy ===");
	const result = timer.start(taskName, "work");
	console.log("Start result:", result);

	if (!result.ok) {
		console.log("Failed to start");
		return;
	}

	const startTime = Date.now();

	// Wait 600ms
	await new Promise((resolve) => setTimeout(resolve, 600));

	const remaining = timer.getRemainingTime();
	const elapsed = (Date.now() - startTime) / 1000;
	const expected = 60 - elapsed;

	console.log("Remaining:", remaining);
	console.log("Elapsed:", elapsed);
	console.log("Expected:", expected);
	console.log("Diff:", Math.abs(remaining - expected));

	timer.stop();
}

// Uncomment to run debug tests
// testPauseResume().then(() => testAccuracy());
