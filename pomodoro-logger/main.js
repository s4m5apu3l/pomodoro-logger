const { Plugin, Notice } = require("obsidian");

const POMODORO_MINUTES = 25;
const LOG_FILE = "pomodoro-log.md";

class PomodoroLoggerPlugin extends Plugin {
  async onload() {
    this.timerId = null;

    this.addCommand({
      id: "start-pomodoro",
      name: "Start Pomodoro (25 minutes)",
      callback: () => this.startPomodoro(),
    });

    this.addCommand({
      id: "stop-pomodoro",
      name: "Stop Pomodoro",
      callback: () => this.stopPomodoro(),
    });
  }

  onunload() {
    this.clearTimer();
  }

  startPomodoro() {
    if (this.timerId !== null) {
      new Notice("A Pomodoro is already running!");
      return;
    }

    new Notice(`Pomodoro started — ${POMODORO_MINUTES} minutes. Stay focused!`);

    this.timerId = setTimeout(async () => {
      this.timerId = null;
      new Notice("🍅 Pomodoro finished! Great work!");
      await this.logSession();
    }, POMODORO_MINUTES * 60 * 1000);
  }

  stopPomodoro() {
    if (this.timerId === null) {
      new Notice("No Pomodoro is currently running.");
      return;
    }

    this.clearTimer();
    new Notice("Pomodoro stopped.");
  }

  clearTimer() {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  async logSession() {
    const adapter = this.app.vault.adapter;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const newRow = `| ${today} | ${POMODORO_MINUTES} |`;

    const header = [
      "| Date       | Minutes |",
      "| ---------- | ------- |",
    ].join("\n");

    const fileExists = await adapter.exists(LOG_FILE);

    if (!fileExists) {
      const content = header + "\n" + newRow + "\n";
      await adapter.write(LOG_FILE, content);
    } else {
      const existing = await adapter.read(LOG_FILE);
      const content = existing.trimEnd() + "\n" + newRow + "\n";
      await adapter.write(LOG_FILE, content);
    }

    new Notice("Session logged to pomodoro-log.md");
  }
}

module.exports = PomodoroLoggerPlugin;
