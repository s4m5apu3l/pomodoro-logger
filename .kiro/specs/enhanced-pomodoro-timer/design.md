# Документ дизайна: Улучшенный таймер Pomodoro

## Обзор

Улучшенный таймер Pomodoro расширяет существующий плагин, добавляя полнофункциональный пользовательский интерфейс в боковой панели, поддержку паузы/возобновления, валидацию названий задач, статистику и улучшенное журналирование. Дизайн следует архитектурным решениям: использование Markdown-таблиц для журнала, вычисление статистики по требованию, персистентность незавершенных сессий и простые настройки уведомлений.

### Ключевые возможности

- Боковая панель с элементами управления таймером и отображением статистики
- Поддержка паузы/возобновления с сохранением состояния
- Обязательный ввод названия задачи с валидацией
- Настраиваемая длительность рабочих сессий и перерывов
- Журнал в формате Markdown с полной информацией о сессиях
- Статистика по дням/неделям/месяцам, вычисляемая по требованию
- Визуальные и звуковые уведомления с переключателем
- Восстановление незавершенных сессий при перезапуске

## Архитектура

### Общая структура

Плагин следует паттерну Model-View-Controller с четким разделением ответственности:

```
PomodoroPlugin (Controller)
├── TimerManager (Model)
│   ├── TimerState
│   └── SessionData
├── LogManager (Model)
│   ├── LogParser
│   └── LogWriter
├── StatisticsCalculator (Model)
├── SidebarView (View)
│   ├── TimerDisplay
│   ├── ControlButtons
│   ├── SettingsPanel
│   └── StatisticsPanel
└── NotificationManager (Service)
```

### Принципы дизайна

1. **Разделение ответственности**: Логика таймера, журналирование, статистика и UI разделены
2. **Простота над производительностью**: Парсинг журнала по требованию вместо кэширования
3. **Персистентность**: Все состояния сохраняются для восстановления после перезапуска
4. **Расширяемость**: Модульная структура позволяет легко добавлять новые функции

## Компоненты и интерфейсы

### 1. TimerManager

Управляет состоянием таймера и логикой отсчета времени.

**Интерфейс:**

```typescript
interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  taskName: string;
  startTime: Date | null;
  sessionType: 'work' | 'break';
}

class TimerManager {
  private state: TimerState;
  private intervalId: number | null;
  private settings: PomodoroSettings;
  
  constructor(settings: PomodoroSettings);
  
  // Управление таймером
  start(taskName: string, sessionType: 'work' | 'break'): Result<void, ValidationError>;
  pause(): void;
  resume(): void;
  stop(): void;
  
  // Получение состояния
  getState(): TimerState;
  getRemainingTime(): number;
  
  // Обработчики событий
  onTick(callback: (remainingSeconds: number) => void): void;
  onComplete(callback: (sessionData: SessionData) => void): void;
  
  // Персистентность
  saveState(): void;
  loadState(): TimerState | null;
}
```

**Ответственность:**
- Отсчет времени с точностью до секунды
- Управление состояниями (running, paused, stopped)
- Валидация названия задачи перед запуском
- Сохранение и восстановление состояния
- Уведомление подписчиков о событиях (tick, complete)

**Детали реализации:**
- Использует Date-based расчет для точности: сохраняет `startTime` и вычисляет `remainingSeconds = totalSeconds - (Date.now() - startTime) / 1000`
- `setInterval` используется только для обновления UI каждую секунду, но не для декремента счетчика
- Это обеспечивает точность таймера независимо от задержек в event loop
- Сохраняет состояние в `plugin.saveData()` при паузе и закрытии
- Валидирует название задачи: не пустое, не только пробелы, максимум 100 символов

### 2. LogManager

Управляет чтением и записью журнала сессий в Markdown-файл.

**Интерфейс:**

```typescript
interface SessionData {
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:MM:SS
  duration: number;      // в минутах
  taskName: string;
  status: 'completed' | 'incomplete';
}

class LogManager {
  private logFilePath: string;
  private vault: Vault;
  
  constructor(vault: Vault, logFilePath: string);
  
  // Запись
  async appendSession(session: SessionData): Promise<void>;
  
  // Чтение
  async readAllSessions(): Promise<SessionData[]>;
  async readSessionsInRange(startDate: Date, endDate: Date): Promise<SessionData[]>;
  
  // Утилиты
  private async ensureLogFileExists(): Promise<void>;
  private formatSessionRow(session: SessionData): string;
}
```

**Ответственность:**
- Создание журнала с заголовком таблицы при первом использовании
- Добавление новых записей в конец файла
- Парсинг Markdown-таблицы в структурированные данные
- Фильтрация записей по диапазону дат

**Формат журнала:**

```markdown
| Date       | Start Time | Duration | Task Name        | Status     |
| ---------- | ---------- | -------- | ---------------- | ---------- |
| 2024-01-15 | 09:30:00   | 25       | Write docs       | completed  |
| 2024-01-15 | 10:00:00   | 5        | Break            | completed  |
| 2024-01-15 | 10:05:00   | 15       | Code review      | incomplete |
```

### 3. LogParser

Парсит Markdown-таблицу журнала в структурированные данные.

**Интерфейс:**

```typescript
class LogParser {
  // Парсинг
  static parseLogFile(content: string): SessionData[];
  static parseRow(row: string): SessionData | null;
  
  // Форматирование
  static formatSession(session: SessionData): string;
  static formatHeader(): string;
  
  // Валидация
  private static isValidRow(row: string): boolean;
  private static extractColumns(row: string): string[];
}
```

**Ответственность:**
- Парсинг строк Markdown-таблицы
- Валидация формата записей
- Форматирование данных обратно в Markdown
- Обработка невалидных записей (пропуск с логированием)

**Детали реализации:**
- Пропускает заголовок таблицы и разделитель
- Использует регулярные выражения для извлечения колонок
- Валидирует формат даты (YYYY-MM-DD) и времени (HH:MM:SS)
- Обеспечивает round-trip: parse(format(session)) === session

### 4. StatisticsCalculator

Вычисляет статистику из данных журнала.

**Интерфейс:**

```typescript
interface Statistics {
  today: {
    completedSessions: number;
    totalMinutes: number;
  };
  thisWeek: {
    completedSessions: number;
    totalMinutes: number;
  };
  thisMonth: {
    completedSessions: number;
    totalMinutes: number;
  };
}

class StatisticsCalculator {
  static calculate(sessions: SessionData[]): Statistics;
  
  private static filterByDate(sessions: SessionData[], startDate: Date, endDate: Date): SessionData[];
  private static filterCompleted(sessions: SessionData[]): SessionData[];
  private static sumDuration(sessions: SessionData[]): number;
  private static getStartOfDay(): Date;
  private static getStartOfWeek(): Date;
  private static getStartOfMonth(): Date;
}
```

**Ответственность:**
- Фильтрация сессий по временным диапазонам
- Подсчет завершенных сессий
- Суммирование времени работы
- Определение границ дня/недели/месяца

**Детали реализации:**
- Учитывает только сессии со статусом "completed"
- Неделя начинается с понедельника
- Месяц определяется по календарному месяцу
- Вычисления выполняются при каждом открытии боковой панели

### 5. SidebarView

Отображает пользовательский интерфейс в боковой панели Obsidian.

**Интерфейс:**

```typescript
class SidebarView extends ItemView {
  private plugin: PomodoroPlugin;
  private timerDisplay: HTMLElement;
  private controlButtons: HTMLElement;
  private settingsPanel: HTMLElement;
  private statisticsPanel: HTMLElement;
  
  constructor(leaf: WorkspaceLeaf, plugin: PomodoroPlugin);
  
  // Lifecycle
  async onOpen(): Promise<void>;
  async onClose(): Promise<void>;
  getViewType(): string;
  getDisplayText(): string;
  getIcon(): string;
  
  // Обновление UI
  updateTimerDisplay(remainingSeconds: number): void;
  updateControlButtons(state: TimerState): void;
  updateStatistics(stats: Statistics): void;
  
  // Рендеринг секций
  private renderTimerSection(): void;
  private renderControlsSection(): void;
  private renderSettingsSection(): void;
  private renderStatisticsSection(): void;
}
```

**Ответственность:**
- Рендеринг всех UI-элементов
- Обработка пользовательских взаимодействий
- Обновление отображения при изменении состояния
- Применение стилей и анимаций

**Структура UI:**

```
┌─────────────────────────────────┐
│  🍅 Pomodoro Timer              │
├─────────────────────────────────┤
│                                 │
│         ⏱️ 25:00                │
│                                 │
│  [▶️ Start] [⏸️ Pause] [⏹️ Stop] │
│                                 │
│  Task: [________________]       │
│                                 │
├─────────────────────────────────┤
│  ⚙️ Settings                    │
│  Work: [25] min                 │
│  Break: [5] min                 │
│  🔔 Sound: [✓]                  │
├─────────────────────────────────┤
│  📊 Statistics                  │
│  Today: 3 sessions (75 min)    │
│  Week: 15 sessions (375 min)   │
│  Month: 60 sessions (1500 min) │
└─────────────────────────────────┘
```

### 6. NotificationManager

Управляет визуальными и звуковыми уведомлениями.

**Интерфейс:**

```typescript
interface NotificationSettings {
  soundEnabled: boolean;
}

class NotificationManager {
  private settings: NotificationSettings;
  
  constructor(settings: NotificationSettings);
  
  // Уведомления о событиях
  notifyTimerStarted(taskName: string, duration: number): void;
  notifyTimerPaused(remainingTime: number): void;
  notifyTimerCompleted(sessionType: 'work' | 'break'): void;
  notifyIncompleteSession(taskName: string, remainingTime: number): void;
  
  // Управление звуком
  setSoundEnabled(enabled: boolean): void;
  
  private playSound(): void;
  private showNotice(message: string): void;
}
```

**Ответственность:**
- Отображение Notice-уведомлений Obsidian
- Воспроизведение звуковых уведомлений
- Управление настройками звука
- Форматирование сообщений уведомлений

**Детали реализации:**
- Использует стандартный API `Notice` из Obsidian
- Звук воспроизводится через Web Audio API
- Звук по умолчанию включен
- Настройка звука сохраняется в settings

### 7. PomodoroPlugin (Main Controller)

Главный класс плагина, координирующий все компоненты.

**Интерфейс:**

```typescript
interface PomodoroSettings {
  workDuration: number;      // минуты
  breakDuration: number;     // минуты
  soundEnabled: boolean;
  logFilePath: string;
}

class PomodoroPlugin extends Plugin {
  settings: PomodoroSettings;
  timerManager: TimerManager;
  logManager: LogManager;
  notificationManager: NotificationManager;
  sidebarView: SidebarView | null;
  
  async onload(): Promise<void>;
  async onunload(): Promise<void>;
  
  // Settings
  async loadSettings(): Promise<void>;
  async saveSettings(): Promise<void>;
  
  // Sidebar
  private registerSidebarView(): void;
  private async activateSidebarView(): Promise<void>;
  
  // Event handlers
  private onTimerTick(remainingSeconds: number): void;
  private onTimerComplete(sessionData: SessionData): void;
  
  // Incomplete session recovery
  private async checkIncompleteSession(): Promise<void>;
}
```

**Ответственность:**
- Инициализация всех компонентов
- Регистрация боковой панели
- Загрузка и сохранение настроек
- Координация взаимодействия между компонентами
- Обработка событий жизненного цикла плагина

## Модели данных

### TimerState

```typescript
interface TimerState {
  isRunning: boolean;        // Таймер активен
  isPaused: boolean;         // Таймер на паузе
  remainingSeconds: number;  // Оставшееся время в секундах
  totalSeconds: number;      // Общая длительность сессии
  taskName: string;          // Название задачи
  startTime: Date | null;    // Время начала сессии
  sessionType: 'work' | 'break';  // Тип сессии
}
```

**Инварианты:**
- `remainingSeconds >= 0`
- `remainingSeconds <= totalSeconds`
- `isRunning && isPaused` не могут быть одновременно true
- `taskName` не пустое, если `isRunning === true`
- `startTime !== null`, если `isRunning === true`

### SessionData

```typescript
interface SessionData {
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:MM:SS
  duration: number;      // в минутах (целое число)
  taskName: string;      // 1-100 символов
  status: 'completed' | 'incomplete';
}
```

**Инварианты:**
- `date` соответствует формату ISO 8601 (YYYY-MM-DD)
- `startTime` соответствует формату HH:MM:SS (24-часовой)
- `duration > 0`
- `taskName.trim().length > 0 && taskName.length <= 100`
- `status` только 'completed' или 'incomplete'

### PomodoroSettings

```typescript
interface PomodoroSettings {
  workDuration: number;      // минуты (по умолчанию 25)
  breakDuration: number;     // минуты (по умолчанию 5)
  soundEnabled: boolean;     // по умолчанию true
  logFilePath: string;       // по умолчанию "pomodoro-log.md"
}
```

**Инварианты:**
- `workDuration > 0 && workDuration <= 120`
- `breakDuration > 0 && breakDuration <= 60`
- `logFilePath` заканчивается на ".md"

### Statistics

```typescript
interface Statistics {
  today: PeriodStats;
  thisWeek: PeriodStats;
  thisMonth: PeriodStats;
}

interface PeriodStats {
  completedSessions: number;  // >= 0
  totalMinutes: number;       // >= 0
}
```

**Инварианты:**
- `completedSessions >= 0`
- `totalMinutes >= 0`
- `totalMinutes === 0` implies `completedSessions === 0`

## Поток данных

### 1. Запуск таймера

```
User clicks Start
  → SidebarView validates task name
  → SidebarView calls TimerManager.start(taskName, 'work')
  → TimerManager validates and starts interval
  → TimerManager saves state
  → NotificationManager shows start notification
  → TimerManager emits tick events every second
  → SidebarView updates display on each tick
```

### 2. Завершение сессии

```
Timer reaches zero
  → TimerManager emits complete event with SessionData
  → PomodoroPlugin receives event
  → LogManager.appendSession(sessionData)
  → NotificationManager shows completion notification
  → SidebarView updates statistics (triggers re-calculation)
```

### 3. Загрузка статистики

```
User opens sidebar
  → SidebarView.onOpen()
  → LogManager.readAllSessions()
  → LogParser.parseLogFile(content)
  → StatisticsCalculator.calculate(sessions)
  → SidebarView.updateStatistics(stats)
```

### 4. Восстановление незавершенной сессии

```
Plugin loads
  → PomodoroPlugin.checkIncompleteSession()
  → TimerManager.loadState()
  → If state exists and was running:
    → Create SessionData with 'incomplete' status
    → LogManager.appendSession(sessionData)
    → NotificationManager.notifyIncompleteSession()
    → Clear saved state
```


## Свойства корректности

*Свойство — это характеристика или поведение, которое должно выполняться во всех валидных выполнениях системы — по сути, формальное утверждение о том, что система должна делать. Свойства служат мостом между человекочитаемыми спецификациями и машинно-проверяемыми гарантиями корректности.*

### Property 1: Запуск таймера с валидным названием задачи

*Для любого* валидного названия задачи (непустое, не только пробелы, ≤100 символов) и настроенной длительности, запуск таймера должен перевести состояние в "running" с правильной длительностью и названием задачи.

**Validates: Requirements 1.1**

### Property 2: Пауза и возобновление сохраняют оставшееся время

*Для любого* активного таймера с произвольным оставшимся временем, выполнение паузы затем возобновления должно сохранить оставшееся время (round-trip свойство).

**Validates: Requirements 1.2, 1.3**

### Property 3: Валидация названия задачи отклоняет пробельные строки

*Для любой* строки, состоящей только из пробельных символов, попытка запуска таймера должна быть отклонена, и состояние таймера должно остаться неизменным.

**Validates: Requirements 2.5**

### Property 4: Многоязычные символы принимаются в названиях задач

*Для любой* строки с Unicode-символами (включая кириллицу, иероглифы, эмодзи) длиной ≤100 символов, система должна принять её как валидное название задачи.

**Validates: Requirements 2.2**

### Property 5: Ограничение длины названия задачи

*Для любой* строки длиннее 100 символов, система должна ограничить ввод до 100 символов.

**Validates: Requirements 2.4**

### Property 6: Персистентность настроек (round-trip)

*Для любых* валидных значений настроек (workDuration, breakDuration, soundEnabled), сохранение затем перезагрузка должны восстановить эквивалентные настройки.

**Validates: Requirements 3.3, 3.4, 10.1, 10.2, 10.3**

### Property 7: Логирование завершенных сессий со всеми полями

*Для любой* завершенной сессии, запись в журнале должна содержать дату (YYYY-MM-DD), время начала (HH:MM:SS), длительность (минуты), название задачи и статус "completed".

**Validates: Requirements 4.1, 4.3**

### Property 8: Логирование незавершенных сессий

*Для любой* прерванной сессии (закрытие с активным таймером), запись в журнале должна содержать все поля и статус "incomplete".

**Validates: Requirements 4.4, 8.4**

### Property 9: Формат журнала как Markdown-таблица

*Для любой* записи сессии, отформатированная строка должна соответствовать формату Markdown-таблицы с колонками: Date | Start Time | Duration | Task Name | Status.

**Validates: Requirements 4.2**

### Property 10: Добавление записей в конец журнала

*Для любой* последовательности сессий, каждая новая запись должна появляться после всех предыдущих записей в журнале.

**Validates: Requirements 4.6**

### Property 11: Round-trip парсинга журнала

*Для любой* валидной записи журнала (SessionData), парсинг затем форматирование затем парсинг должны производить эквивалентную запись.

**Validates: Requirements 6.4**

### Property 12: Парсинг извлекает все поля

*Для любой* валидной строки Markdown-таблицы журнала, парсинг должен корректно извлечь дату, время начала, длительность, название задачи и статус.

**Validates: Requirements 6.2**

### Property 13: Валидация формата журнала

*Для любой* строки, не соответствующей формату Markdown-таблицы, парсер должен отклонить её или вернуть null.

**Validates: Requirements 6.1**

### Property 14: Статистика учитывает только завершенные сессии

*Для любого* набора сессий с разными статусами, вычисленная статистика должна включать только сессии со статусом "completed".

**Validates: Requirements 5.9**

### Property 15: Подсчет сессий за период

*Для любого* набора сессий и временного периода (день/неделя/месяц), количество завершенных сессий должно равняться количеству сессий со статусом "completed" в этом периоде.

**Validates: Requirements 5.2, 5.3, 5.4**

### Property 16: Суммирование времени за период

*Для любого* набора завершенных сессий в периоде, общее время должно равняться сумме длительностей всех сессий в этом периоде.

**Validates: Requirements 5.5, 5.6, 5.7**

### Property 17: Условное воспроизведение звука

*Для любого* события завершения таймера, звук должен воспроизводиться тогда и только тогда, когда soundEnabled === true.

**Validates: Requirements 7.2**

### Property 18: Сохранение состояния при закрытии

*Для любого* активного таймера с оставшимся временем, сохранение состояния затем загрузка должны восстановить название задачи и оставшееся время.

**Validates: Requirements 8.1**

### Property 19: Уведомление о незавершенной сессии содержит детали

*Для любой* незавершенной сессии, уведомление должно содержать название задачи и оставшееся время.

**Validates: Requirements 8.3**

### Property 20: Точность таймера на основе Date

*Для любого* запущенного таймера, оставшееся время должно вычисляться как `totalSeconds - (Date.now() - startTime) / 1000`, а не через декремент счетчика, обеспечивая точность независимо от задержек event loop.

**Validates: Timer accuracy requirement (design decision)**

## Обработка ошибок

### 1. Валидация входных данных

**Невалидное название задачи:**
- Пустая строка или только пробелы → Показать Notice: "Введите название задачи"
- Длина > 100 символов → Автоматически обрезать до 100 символов
- Действие: Предотвратить запуск таймера

**Невалидные настройки длительности:**
- workDuration ≤ 0 или > 120 → Использовать значение по умолчанию (25 минут)
- breakDuration ≤ 0 или > 60 → Использовать значение по умолчанию (5 минут)
- Действие: Показать Notice с предупреждением и использовать значение по умолчанию

### 2. Ошибки файловой системы

**Файл журнала не может быть создан:**
- Причина: Нет прав доступа или недостаточно места
- Действие: Показать Notice с ошибкой, продолжить работу таймера без логирования
- Логирование: Записать ошибку в console.error

**Файл журнала не может быть прочитан:**
- Причина: Файл поврежден или недоступен
- Действие: Показать Notice с предупреждением, вернуть пустую статистику
- Логирование: Записать ошибку в console.error

**Ошибка записи в журнал:**
- Причина: Файл заблокирован или недостаточно места
- Действие: Показать Notice с ошибкой, сохранить сессию в памяти для повторной попытки
- Логирование: Записать ошибку в console.error

### 3. Ошибки парсинга журнала

**Невалидная строка в журнале:**
- Причина: Ручное редактирование или повреждение файла
- Действие: Пропустить невалидную строку, продолжить парсинг остальных
- Логирование: Записать предупреждение в console.warn с номером строки

**Невалидный формат даты/времени:**
- Причина: Неправильный формат в записи
- Действие: Пропустить запись, не включать в статистику
- Логирование: Записать предупреждение в console.warn

**Пустой файл журнала:**
- Действие: Вернуть пустой массив сессий, статистика будет нулевой
- Это нормальное состояние для нового пользователя

### 4. Ошибки состояния таймера

**Попытка паузы неактивного таймера:**
- Действие: Игнорировать, не менять состояние
- Логирование: Записать предупреждение в console.warn

**Попытка возобновления незапаузенного таймера:**
- Действие: Игнорировать, не менять состояние
- Логирование: Записать предупреждение в console.warn

**Попытка запуска уже активного таймера:**
- Действие: Показать Notice: "Таймер уже запущен"
- Не менять текущее состояние

### 5. Ошибки персистентности

**Не удается сохранить состояние:**
- Причина: Ошибка в plugin.saveData()
- Действие: Показать Notice с предупреждением, продолжить работу
- Логирование: Записать ошибку в console.error
- Последствие: Состояние может быть потеряно при перезапуске

**Не удается загрузить состояние:**
- Причина: Поврежденные данные в хранилище
- Действие: Использовать настройки по умолчанию, показать Notice
- Логирование: Записать ошибку в console.error

### 6. Ошибки уведомлений

**Не удается воспроизвести звук:**
- Причина: Браузер блокирует autoplay или нет аудио-файла
- Действие: Показать только визуальное уведомление
- Логирование: Записать предупреждение в console.warn

### 7. Стратегия обработки ошибок

**Принципы:**
1. **Graceful degradation**: Система продолжает работать при некритичных ошибках
2. **User feedback**: Пользователь всегда информируется об ошибках через Notice
3. **Logging**: Все ошибки логируются в console для отладки
4. **Data integrity**: Приоритет на сохранение данных пользователя
5. **Silent recovery**: Невалидные записи в журнале пропускаются без остановки работы

**Критичные ошибки** (останавливают функцию):
- Невалидное название задачи при запуске
- Невалидные настройки длительности

**Некритичные ошибки** (логируются, работа продолжается):
- Ошибки чтения/записи журнала
- Невалидные записи в журнале
- Ошибки воспроизведения звука
- Ошибки персистентности состояния

## Стратегия тестирования

### Подход к тестированию

Система использует **двойной подход к тестированию**, комбинируя unit-тесты и property-based тесты для обеспечения всесторонней проверки корректности:

- **Unit-тесты**: Проверяют конкретные примеры, граничные случаи и условия ошибок
- **Property-тесты**: Проверяют универсальные свойства на множестве сгенерированных входных данных
- Оба подхода дополняют друг друга: unit-тесты ловят конкретные баги, property-тесты проверяют общую корректность

### Библиотека для property-based тестирования

Для TypeScript будет использоваться библиотека **fast-check**:
- Зрелая библиотека с хорошей поддержкой TypeScript
- Богатый набор генераторов для различных типов данных
- Поддержка shrinking для минимизации failing examples
- Интеграция с Jest/Vitest

### Конфигурация property-тестов

Каждый property-тест должен:
- Выполняться минимум **100 итераций** (из-за рандомизации)
- Иметь комментарий-тег: **Feature: enhanced-pomodoro-timer, Property {N}: {property_text}**
- Ссылаться на соответствующее свойство из раздела "Свойства корректности"

Пример:
```typescript
// Feature: enhanced-pomodoro-timer, Property 11: Round-trip парсинга журнала
test('parsing then formatting then parsing produces equivalent record', () => {
  fc.assert(
    fc.property(sessionDataArbitrary, (session) => {
      const formatted = LogParser.formatSession(session);
      const parsed = LogParser.parseRow(formatted);
      expect(parsed).toEqual(session);
    }),
    { numRuns: 100 }
  );
});
```

### Покрытие тестами

#### 1. TimerManager

**Unit-тесты:**
- Запуск таймера с валидным названием задачи
- Запуск таймера с невалидным названием (пустое, только пробелы)
- Завершение таймера (достижение нуля)
- Попытка паузы неактивного таймера
- Попытка возобновления незапаузенного таймера
- Сохранение и загрузка состояния

**Property-тесты:**
- Property 1: Запуск с любым валидным названием
- Property 2: Пауза/возобновление сохраняют время
- Property 3: Отклонение пробельных строк
- Property 4: Принятие многоязычных символов
- Property 5: Ограничение длины названия
- Property 20: Точность таймера на основе Date

#### 2. LogManager и LogParser

**Unit-тесты:**
- Создание файла журнала при первом использовании
- Добавление записи в существующий журнал
- Чтение пустого журнала
- Обработка поврежденного файла журнала
- Парсинг валидной строки таблицы
- Парсинг невалидной строки (пропуск)

**Property-тесты:**
- Property 7: Логирование завершенных сессий
- Property 8: Логирование незавершенных сессий
- Property 9: Формат Markdown-таблицы
- Property 10: Добавление в конец журнала
- Property 11: Round-trip парсинга
- Property 12: Извлечение всех полей
- Property 13: Валидация формата

#### 3. StatisticsCalculator

**Unit-тесты:**
- Вычисление статистики для пустого журнала
- Вычисление статистики для одной сессии
- Фильтрация по дате (сегодня/неделя/месяц)
- Граничные случаи (полночь, начало недели, начало месяца)

**Property-тесты:**
- Property 14: Учет только завершенных сессий
- Property 15: Подсчет сессий за период
- Property 16: Суммирование времени за период

#### 4. NotificationManager

**Unit-тесты:**
- Уведомление при запуске таймера
- Уведомление при паузе
- Уведомление при завершении
- Уведомление о незавершенной сессии
- Воспроизведение звука при soundEnabled=true
- Отсутствие звука при soundEnabled=false

**Property-тесты:**
- Property 17: Условное воспроизведение звука
- Property 19: Содержимое уведомления о незавершенной сессии

#### 5. PomodoroPlugin (Settings)

**Unit-тесты:**
- Загрузка настроек по умолчанию
- Сохранение измененных настроек
- Обработка поврежденных настроек
- Валидация границ длительности

**Property-тесты:**
- Property 6: Round-trip персистентности настроек
- Property 18: Сохранение состояния при закрытии

#### 6. SidebarView

**Unit-тесты:**
- Рендеринг начального состояния
- Обновление отображения таймера
- Обновление кнопок управления
- Обновление статистики
- Обработка кликов на кнопки

**Integration-тесты:**
- Полный цикл: запуск → пауза → возобновление → завершение
- Запуск → закрытие → восстановление незавершенной сессии
- Изменение настроек → перезагрузка → проверка сохранения

### Генераторы для property-тестов

Необходимо создать следующие генераторы (arbitraries) для fast-check:

```typescript
// Генератор валидных названий задач
const validTaskNameArbitrary = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

// Генератор многоязычных строк
const unicodeTaskNameArbitrary = fc.fullUnicode({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

// Генератор пробельных строк
const whitespaceStringArbitrary = fc.array(fc.constantFrom(' ', '\t', '\n'))
  .map(arr => arr.join(''));

// Генератор SessionData
const sessionDataArbitrary = fc.record({
  date: fc.date().map(d => d.toISOString().split('T')[0]),
  startTime: fc.tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 0, max: 59 })
  ).map(([h, m, s]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`),
  duration: fc.integer({ min: 1, max: 120 }),
  taskName: validTaskNameArbitrary,
  status: fc.constantFrom('completed', 'incomplete')
});

// Генератор настроек
const settingsArbitrary = fc.record({
  workDuration: fc.integer({ min: 1, max: 120 }),
  breakDuration: fc.integer({ min: 1, max: 60 }),
  soundEnabled: fc.boolean(),
  logFilePath: fc.constant('pomodoro-log.md')
});
```

### Баланс unit и property тестов

**Unit-тесты фокусируются на:**
- Конкретных примерах, демонстрирующих корректное поведение
- Точках интеграции между компонентами
- Граничных случаях и условиях ошибок
- Специфических сценариях использования

**Property-тесты фокусируются на:**
- Универсальных свойствах, выполняющихся для всех входных данных
- Всестороннем покрытии входных данных через рандомизацию
- Инвариантах и математических свойствах (round-trip, идемпотентность)
- Обнаружении edge cases, о которых не подумали при написании unit-тестов

**Избегать:**
- Слишком много unit-тестов для случаев, покрываемых property-тестами
- Property-тесты для UI-специфичных деталей (использовать unit-тесты)
- Дублирование тестов между unit и property подходами

### Стратегия интеграционного тестирования

**Сценарии end-to-end:**
1. Полный рабочий цикл: запуск → работа → завершение → проверка журнала
2. Цикл с паузой: запуск → пауза → возобновление → завершение
3. Прерванная сессия: запуск → закрытие → перезапуск → проверка уведомления
4. Изменение настроек: изменение → сохранение → перезагрузка → проверка
5. Накопление статистики: несколько сессий → проверка подсчетов

**Моки и стабы:**
- Мокировать Obsidian API (Vault, Notice, Plugin)
- Мокировать файловую систему для тестов LogManager
- Мокировать Date.now() для тестов точности таймера
- Мокировать Web Audio API для тестов звуковых уведомлений

### Метрики качества

**Целевые показатели:**
- Покрытие кода: ≥ 80%
- Все 20 correctness properties реализованы как property-тесты
- Минимум 100 итераций на каждый property-тест
- Все критичные пути покрыты integration-тестами
- Все обработчики ошибок покрыты unit-тестами

**Continuous Integration:**
- Запуск всех тестов при каждом коммите
- Проверка покрытия кода
- Проверка линтинга и форматирования
- Автоматическая сборка плагина
