# CONTRIBUTING

Руководство по написанию кода бэкенда ГАДЮКИ. Цель — код, который читается сверху вниз как текст,
меняется в одном месте и расширяется без правки существующего.

Краткая версия правил для AI-агента — в [CLAUDE.md](CLAUDE.md). Этот документ объясняет **почему** и показывает **как**.
Запуск, скрипты и переменные окружения — в [../README.md](../README.md).

---

## Содержание

1. [Принципы](#1-принципы)
2. [ООП и классы](#2-ооп-и-классы)
3. [Методы: размер, имена, параметры](#3-методы-размер-имена-параметры)
4. [Boolean-параметр = два метода](#4-boolean-параметр--два-метода)
5. [Ветвление: стратегии и фабрики](#5-ветвление-стратегии-и-фабрики)
6. [Каталог паттернов](#6-каталог-паттернов)
7. [Слои и ответственность](#7-слои-и-ответственность)
8. [HTTP API: группы, доступ, контракты](#8-http-api-группы-доступ-контракты)
9. [Именование](#9-именование)
10. [Типы](#10-типы)
11. [Ошибки и валидация](#11-ошибки-и-валидация)
12. [Данные: Prisma и SQL](#12-данные-prisma-и-sql)
13. [Логирование](#13-логирование)
14. [Тесты](#14-тесты)
15. [Антипаттерны и рефакторинг](#15-антипаттерны-и-рефакторинг)
16. [Git и процесс](#16-git-и-процесс)
17. [Чек-лист ревью](#17-чек-лист-ревью)

---

## 1. Принципы

### KISS — Keep It Simple
Выбираем самое простое решение, которое решает **текущую** задачу. Абстракция появляется,
когда есть второй реальный случай, а не «вдруг пригодится».

### DRY — Don't Repeat Yourself
Каждое **знание** (правило, формула, формат) живёт в одном месте: формат ключа медиа — в `MediaKeys`,
лимиты загрузки — в `src/core/media/media.constants.ts`, тексты — в `shared/messages`.
Важно: совпадение кода ≠ дублирование знания. Два метода, которые сегодня выглядят одинаково,
но меняются по разным причинам, объединять нельзя — это создаст ложную связность.

### YAGNI — You Aren't Gonna Need It
Не добавляем параметры, флаги, слои и настройки «на будущее». Неиспользуемый код — это долг.

### SOLID

| Буква | Принцип | В нашем коде |
|---|---|---|
| **S** | Single Responsibility | Класс меняется по одной причине. Usecase — один сценарий, Repository — один источник данных, Strategy — один вариант поведения. |
| **O** | Open/Closed | Новый вариант поведения = новый класс-стратегия. Существующие классы не правим. |
| **L** | Liskov Substitution | Любая реализация интерфейса подставляется вместо другой без `instanceof` (`SessionRepository` ⇄ `InMemorySessionRepository`). |
| **I** | Interface Segregation | Интерфейс содержит только то, что нужно клиенту. Лучше два маленьких, чем один «толстый». |
| **D** | Dependency Inversion | Высокоуровневый код зависит от абстракций (интерфейс + DI-токен), а не от конкретных классов. |

### Дополнительно
- **Composition over inheritance** — собираем поведение из внедрённых объектов; наследование классов — максимум один уровень (раздел 2.2).
- **Law of Demeter** — не лезем в «чужие внутренности»: `lead.contacts.phone.digits` → `lead.maskedPhone()`.
- **Tell, don't ask** — просим объект сделать действие, а не забираем его данные, чтобы решить за него.
- **Fail fast** — некорректный вход отсекается на границе (DTO, pipe, guard, валидация env при старте), а не в глубине.

---

## 2. ООП и классы

### 2.1. Четыре опоры ООП

| Принцип | Что значит у нас |
|---|---|
| **Инкапсуляция** | Состояние класса — `private readonly`. Наружу — только методы-действия, не сеттеры. Инварианты проверяются в конструкторе/статическом `create`, объект не может оказаться в невалидном состоянии. |
| **Абстракция** | Клиент работает с интерфейсом (`ISessionRepository`, `LeadMessagePresenter`), а не с реализацией. Публичный API класса — минимальный, детали — в `private`. |
| **Полиморфизм** | Разное поведение — через разные реализации одного интерфейса, а не через `if`/`switch` по типу (раздел 5). |
| **Наследование** | Ограничено: **максимум один уровень** (см. 2.2). По умолчанию — композиция. |

```ts
// ❌ Инкапсуляция нарушена: состояние открыто, правило снаружи
export class Lead {
  public status: LeadStatus;
}
lead.status = LeadStatus.DONE; // кто проверил, что из SPAM можно перейти в DONE?

// ✅ Состояние скрыто, переход — через метод с правилом
export class Lead {
  constructor(private status: LeadStatus) {}

  complete(): void {
    if (!this.canComplete()) throw new LeadCannotBeCompletedException(this.status);
    this.status = LeadStatus.DONE;
  }

  canComplete(): boolean {
    return this.status === LeadStatus.NEW || this.status === LeadStatus.IN_PROGRESS;
  }
}
```

### 2.2. Наследование — максимум один уровень

**Класс может наследоваться только от одного базового класса, и этот базовый класс сам ни от кого не наследуется.**
Глубина иерархии классов — 1: `Base ← Concrete`, без `Base ← Middle ← Concrete`.

Почему:
- глубокая иерархия прячет поведение по нескольким файлам — чтобы понять метод, нужно пройти всю цепочку;
- изменение в середине цепочки ломает всех потомков (хрупкий базовый класс);
- `super`-вызовы и `protected`-состояние создают скрытую связность.

Когда наследование класса допустимо:
- **Template Method** — абстрактный базовый класс задаёт алгоритм, наследник реализует шаги (5.3);
- наследование от класса фреймворка/библиотеки — это единственный уровень в нашем коде:
  `DomainException extends Error` и все наши исключения напрямую от `DomainException`;
  `ApiValidationPipe extends ValidationPipe`, `LoginThrottlerGuard extends ThrottlerGuard`, `AppLogger extends ConsoleLogger`.

```ts
// ❌ Цепочка наследования
export class BaseRepository { … }
export class BaseContentRepository extends BaseRepository { … }
export class NewsRepository extends BaseContentRepository { … }

// ✅ Один уровень + композиция
export class InvalidCredentialsException extends DomainException { … }

export class NewsRepository {
  constructor(private readonly database: DatabaseService, private readonly localizedText: LocalizedTextReader) {}
}
```

Нужен общий код для нескольких классов, а уровень наследования уже занят — выносим общее в отдельный
класс и **внедряем** его (композиция), а не добавляем промежуточный базовый класс.

### 2.3. Исключение: `interface` и `type`

Ограничение глубины касается **только классов**. Интерфейсы и типы описывают контракт без поведения,
поэтому их можно расширять, комбинировать и реализовывать классом сразу несколько:

```ts
export interface Identified {
  readonly id: string;
}

export interface Timestamped {
  readonly createdAt: Date;
}

export interface LeadRow extends Identified, Timestamped {
  readonly type: LeadType;
}

export class HealthResponse implements HealthResponseContract { … }
```

Держите интерфейсы узкими (Interface Segregation): лучше составить контракт из нескольких маленьких,
чем раздувать один.

### 2.4. Composition over inheritance

| Нужно | Решение |
|---|---|
| Общий шаг у нескольких классов | Отдельный класс-сервис, внедрённый в каждый (`HtmlEscaper`, `ClientIpResolver`) |
| Разные варианты поведения | Стратегии с общим интерфейсом |
| Общий алгоритм с разными шагами | Template Method (один уровень наследования) |
| Общая форма данных | `interface` / `type` (можно наследовать и комбинировать свободно) |

### 2.5. Классы вместо функций

**Вся логика — методы классов.** Запрещены свободные функции и файлы `utils.ts`/`helpers.ts`.

Почему:
- у метода есть владелец — понятно, где искать и кто отвечает;
- класс внедряется через DI и подменяется в тесте;
- приватные методы скрывают детали, публичный API остаётся узким.

```ts
// ❌ Плохо: свободная функция в helpers.ts
export const maskPhone = (phone: string): string => …;
```

```ts
// ✅ Хорошо: поведение принадлежит классу (src/module/telegram/src/contact-masker.ts)
export class ContactMasker {
  private static readonly VISIBLE_PHONE_DIGITS = 4;

  maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= ContactMasker.VISIBLE_PHONE_DIGITS) return '***';
    return `+${digits.slice(0, 1)}${'*'.repeat(digits.length - 5)}${digits.slice(-4)}`;
  }
}
```

Исключение — декораторы Nest: они создаются фабриками (`Reflector.createDecorator`, `createParamDecorator`),
а логика параметра живёт в методе класса (`createParamDecorator(RequestContext.clientIpOf)`).

Где живёт логика:

| Что | Где |
|---|---|
| Правило сущности (валидация, расчёт, преобразование) | доменный класс / value object в `src/core/<entity>/` |
| Сценарий (последовательность шагов) | `*.usecase.ts` |
| Вариант поведения | `*.strategy.ts` / реализация интерфейса |
| Сборка объекта | `*.factory.ts` |
| Доступ к данным | `*.repository.ts` |
| Общая техническая логика | класс в `src/module/<infra>/` (или `src/module/common`) |

---

## 3. Методы: размер, имена, параметры

### 3.1. Не более 10 строк

Тело метода — **не более 10 строк**. Короткий метод делает одну вещь, получает точное имя и
тестируется без сложной подготовки. Вырос — выделяем шаги в `private`-методы, публичный метод
становится оглавлением:

```ts
// ✅ src/module/auth-token/src/auth-session.service.ts
async refresh(refreshToken: string): Promise<SessionTokens> {
  const stored = await this.findUsableToken(refreshToken);
  const refresh = await this.rotate(stored);
  const { userId, role } = stored.session;
  return { access: this.accessTokens.issue({ id: userId, role, sessionId: stored.sessionId }), refresh };
}
```

### 3.2. Один уровень абстракции

В одном методе не смешиваем «что» и «как». Если рядом стоят `this.notifier.notify(lead)` и
`phone.replace(/\D/g, '')` — второе уходит в отдельный метод (или класс) с именем.

### 3.3. Имя точно описывает действие

- Глагол + объект: `findServableKey`, `buildObjectKey`, `revokeAllForUser`, `formatForOwner`.
- Имя **полное**: если метод ещё и сохраняет — это не `calculate`, а два метода.
- «And»/«Or» в имени — сигнал разделить метод.

| Префикс | Значение |
|---|---|
| `find*` | может вернуть `null`/`undefined`/пустой список |
| `get*` | возвращает значение или бросает исключение |
| `*OrThrow`, `assert*` | явно бросает, если не найдено / не выполнено |
| `is*`, `has*`, `can*` | предикат, возвращает `boolean`, без побочных эффектов |
| `build*`, `create*` | создаёт объект, без I/O |
| `save*`, `update*`, `delete*`, `revoke*` | меняет состояние |
| `to*` | преобразование в другой тип (`toStoredToken`, `toResponse`) |

### 3.4. Параметры

- **Не больше 3.** Больше — один объект-параметр (интерфейс/DTO).
- Никаких `null` как «не передано» — отдельный метод или необязательное поле объекта-параметра.
- Порядок: главный объект → уточнения.
- Не мутируем входные параметры.

```ts
// ❌
findLeads(type: LeadType, status: LeadStatus, from: Date, to: Date, cursor: string, limit: number)

// ✅
findLeads(filter: LeadFilter, page: CursorPage)
```

### 3.5. Поток управления

- **Ранний возврат** (guard clause) вместо `else` и вложенности.
- Вложенность блоков — не глубже 2.
- Без `else` после `return`/`throw`.

### 3.6. Command/Query Separation

Метод **либо** меняет состояние, **либо** возвращает данные. `findSession()`, который заодно
обновляет `lastUsedAt`, — ловушка для того, кто его вызовет.

---

## 4. Boolean-параметр = два метода

Булев флаг означает, что метод делает **две разные вещи**: вызов становится нечитаемым
(`format(lead, true)`), внутри появляется ветвление.

```ts
// ❌ Плохо
format(lead: TelegramLead, redact: boolean): string { … }

// ✅ Хорошо: два метода с говорящими именами, различие — в стратегии
formatForOwner(lead: TelegramLead, siteUrl: string): string {
  return this.format(lead, new OwnerLeadMessagePresenter(siteUrl));
}

formatPreview(lead: TelegramLead): string {
  return this.format(lead, new PreviewLeadMessagePresenter());
}
```

Если вариантов больше двух или флаг приходит извне (из запроса) — это enum и стратегии
(раздел 5). То же касается флагов-режимов в построителях запросов и опций вида `{ mode: 'short' | 'full' }`.

---

## 5. Ветвление: стратегии и фабрики

### 5.1. Проблема

```ts
// ❌ Каждый новый тип заявки — правка этого метода и всех похожих
emojiOf(type: LeadType): string {
  if (type === LeadType.TAILORING) return '🧵';
  if (type === LeadType.PARTNERSHIP) return '🤝';
  return '💬';
}
```

Нарушены O (правим старый код) и S (метод знает про все типы), и такие `if` расползаются по проекту.

### 5.2. Решение: Strategy + карта по enum

Простые различия — карта значений; различия в поведении — карта стратегий с общим интерфейсом:

```ts
// src/module/telegram/src/lead-message.formatter.ts
private static readonly EMOJI: Readonly<Record<LeadType, string>> = {
  [LeadType.TAILORING]: '🧵',
  [LeadType.PARTNERSHIP]: '🤝',
  [LeadType.CONTACT]: '💬',
};
```

```ts
// Поведение по статусу доставки: одна стратегия на значение enum
const reporters: Record<TelegramDeliveryStatus, () => void> = {
  [TelegramDeliveryStatus.SENT]: () => undefined,
  [TelegramDeliveryStatus.DRY_RUN]: () => this.reportDryRun(lead),
  [TelegramDeliveryStatus.FAILED]: () => this.logger.warn('…', { lead_id: lead.id }),
};
reporters[result.status]();
```

`Record<Enum, …>` заставляет TypeScript проверить, что для **каждого** значения enum есть вариант.
Добавили значение в enum (`prisma/models/enums.prisma`) — компиляция упадёт, пока не добавите вариант.

**Правило:** один метод, принимающий `type`, + стратегии внутри. Пары `notifyTailoring()` /
`notifyPartnership()` на уровне usecase не делаем.

### 5.3. Общий код стратегий

Если у стратегий есть общий алгоритм с отличающимися шагами — **Template Method**: абстрактный
базовый класс задаёт алгоритм, наследники реализуют шаги; базовый класс сам ни от кого не наследуется.
Если общий только кусок — выносим его в отдельный внедряемый класс (композиция).

### 5.4. Factory

Фабрика нужна, когда надо **создать** объект: выбрать класс, собрать из нескольких источников,
применить правила по умолчанию. Фабрика не делает I/O.

```ts
// src/module/telegram/src/telegram-options.factory.ts
export class TelegramOptionsFactory {
  static fromConfig(config: ConfigService): TelegramOptions {
    return {
      token: config.get('TELEGRAM_BOT_TOKEN') ?? '',
      chatId: config.get('TELEGRAM_OWNER_ID') ?? '',
      dryRun: config.getSafety('TELEGRAM_DRY_RUN'),
      siteUrl: config.getSafety('SITE_URL').replace(/\/+$/, ''),
      isProduction: config.getSafety('NODE_ENV') === EnvironmentEnum.prod,
    };
  }
}
```

### 5.5. Когда `if` допустим

- Guard clause (проверка входа, ранний возврат).
- Предикат доменного правила (`if (data.byteLength > MAX_UPLOAD_BYTES)`), а не выбор реализации по типу.
- Ровно два исхода, которые никогда не будут расширяться, и обе ветки — одна строка.

Если сомневаетесь — стратегия.

---

## 6. Каталог паттернов

| Паттерн | Задача | Где в проекте |
|---|---|---|
| **Strategy** | Разное поведение для разных типов | карта `Record<Enum, Strategy>`, `LeadMessagePresenter` |
| **Factory** | Создание объекта с правилами | `*.factory.ts` (`TelegramOptionsFactory`, `MediaStorageOptionsFactory`) |
| **Template Method** | Общий алгоритм, разные шаги | абстрактный `Base*` (один уровень) |
| **Repository** | Доступ к данным за интерфейсом | `*.repository.ts`, `ISessionRepository` |
| **Usecase (Application Service)** | Один сценарий, оркестрация | `*.usecase.ts` |
| **DTO** | Контракт входа, валидация | `*.dto.ts` (+ интерфейс в `shared/contracts`) |
| **Value Object** | Неизменяемое значение с правилами | `src/core/*` (`OriginalFileName`, `PostgresUrl`) |
| **Adapter** | Обёртка над внешним API | `TelegramTransport` (Bot API), `MediaStorage` (S3) |
| **Decorator** | Сквозная логика без правки класса | `src/decorator/` (`@Public`, `@Roles`, `@CurrentUser`) |
| **Chain of Responsibility** | Последовательная обработка | глобальные гарды: internal key → сессия → роль |
| **Null Object** | Поведение «ничего не делать» вместо `if (x)` | стратегия-заглушка (`SENT: () => undefined`) |

### Value Object

```ts
export class OriginalFileName {
  private constructor(private readonly value: string) {}

  static fromUpload(name: string): OriginalFileName {
    const cleaned = OriginalFileName.clean(OriginalFileName.baseName(name));
    return new OriginalFileName(cleaned.length > 0 ? cleaned : 'image');
  }

  toString(): string {
    return this.value;
  }
}
```

Неизменяемый, валидирует себя при создании, несёт поведение. Деньги — целые рубли (`price Int`), никогда не float.

### Adapter

```ts
@Injectable()
export class TelegramTransport {
  async send(text: string): Promise<TelegramSendResult> { … }
}
```

Внешний формат (ответ Bot API) не протекает внутрь — наружу отдаётся `TelegramSendResult`.

---

## 7. Слои и ответственность

```
controller → usecase → domain / repository → module (инфраструктура)
```

Импорты только «вниз». `src/core` не знает про Nest, HTTP и базу.

| Слой | Делает | Не делает |
|---|---|---|
| **Controller** | Маршрут, DTO, декораторы доступа и Swagger, вызов usecase | Логику, обращения к БД, условия, сборку ответа |
| **Usecase** | Оркестрацию сценария, транзакционные границы, сборку ответа (`*.response.ts`) | Prisma/SQL, HTTP-детали |
| **Domain** (`src/core`) | Правила сущности, расчёты, инварианты | I/O, логирование, DI |
| **Repository** | Запросы Prisma, маппинг строк в доменные объекты | Бизнес-решения |
| **Module/infra** (`src/module`) | БД-клиенты, S3, Telegram, JWT, хеширование, тексты | Бизнес-логику сценариев |

### Контроллер передаёт поля явно

```ts
@Public()
@UseGuards(LoginThrottlerGuard)
@HttpCode(HttpStatus.OK)
@Post(LOGIN_ROUTE)
async execute(@Body() dto: LoginDto, @UserAgent() userAgent: string | undefined): Promise<AuthTokensResponse> {
  return this.usecase.execute({ login: dto.login, password: dto.password, userAgent });
}
```

Не `execute(dto)` целиком: явная передача делает контракт usecase видимым и не даёт лишним полям
«просочиться». Добавили поле в DTO — добавьте его в вызов, в `shared/contracts` и в e2e-тест.

### Набор файлов эндпоинта

```
src/usecases/<group>/<feature>/<method>/      npm run gen:usecase
├── <feature>.controller.ts
├── <feature>.usecase.ts
├── <feature>.repository.ts
├── <feature>.dto.ts
├── <feature>.response.ts
├── <feature>.route.ts                        `${API_VERSION}/<group>/<feature>`
└── <feature>.e2e.test.ts
```

Регистрация — в модуле группы (`public.module.ts`, `auth.module.ts`, `admin.module.ts`): контроллер в
`controllers`, usecase и repository в `providers`.

---

## 8. HTTP API: группы, доступ, контракты

- Все маршруты — под `API_VERSION` (`/api/v1`), кроме `GET|HEAD /media/*` (публичный адрес файлов).
- Бэкенд не открыт в интернет: его вызывает только сервер Next.js с заголовком `x-internal-key`
  (`InternalKeyGuard`, глобальный). IP посетителя приходит в `x-client-ip` (`@ClientIp()`), его User-Agent — в
  `x-client-user-agent` (`@UserAgent()`; собственный `user-agent` запроса — HTTP-клиент сервера Next.js, его не читаем).
- Бюджет времени: ответ укладывается в таймаут клиента (`ApiRequestTimeoutMs` в `shared/contracts/http.ts`):
  транзакции, ожидание соединения и внешние вызовы маршрута — короче его (дольше — свой тип-таймаут в контракте
  области, как `LeadResendTimeoutMs`). Внутри открытой интерактивной транзакции — только запросы самой транзакции:
  чтение через основной клиент ждёт соединения пула, которые держат открытые транзакции (взаимоблокировка под нагрузкой).
- Группы: **public** (`@Public()`: данные сайта без входа), **auth** (вход: login/refresh/logout публичные,
  `me` — с сессией), **admin** (`@Roles([UserRole.ADMIN])` на каждом контроллере).
- Сессия: `Authorization: Bearer <access JWT>` (HS256, 15 мин, `{ sub, role, sid }`), проверка, что
  сессия `sid` не отозвана — на каждом запросе (`AuthGuard`). Refresh-токен `<id>.<secret>`, в БД — только
  sha256; обмен ровно один раз, повторное предъявление отзывает всю сессию.
- Типы запросов и ответов — в `shared/contracts/*.ts` (только типы). Класс-ответ бэкенда
  `implements` интерфейс контракта, DTO — интерфейс запроса: расхождение ломает сборку.

---

## 9. Именование

| Что | Стиль | Пример |
|---|---|---|
| Файл | `kebab-case.<role>.ts` | `lead-message.formatter.ts` |
| Класс | `PascalCase` + роль | `LeadMessageFormatter` |
| Интерфейс | `PascalCase`, `I*` — только для портов с несколькими реализациями | `TelegramLead`, `ISessionRepository` |
| Enum | `PascalCase` / `UPPER_SNAKE_CASE` | `LeadType.TAILORING` |
| Константа | `UPPER_SNAKE_CASE` (модульная или `static readonly`) | `MAX_UPLOAD_BYTES` |
| DI-токен | `UPPER_SNAKE_CASE` | `SESSION_REPOSITORY` |
| Переменная/метод | `camelCase` | `activeSession` |
| Boolean | `is/has/can` | `isProduction` |
| Таблица / колонка | `snake_case`, таблица во множественном числе | `refresh_tokens.token_hash` |

Правила:
- Имя отвечает на вопрос «что это», а не «как устроено»: `servableKey`, а не `filteredString`.
- Без шумовых слов: `data`, `info`, `item`, `obj`, `manager`, `handler2`, `tmp`.
- Без сокращений, кроме общепринятых (`id`, `dto`, `url`, `ip`).
- Коллекции — во множественном числе, словари — `<value>By<Key>`: `leadsById`.
- Одно понятие — одно слово во всём проекте (не `fetch`/`get`/`load` вперемешку).

---

## 10. Типы

- `strict: true`. Запрещены `any`, `@ts-ignore`, `as unknown as`.
- `!` (non-null assertion) — только с комментарием, почему значение гарантировано.
- Публичные методы — с явным типом возврата.
- Вместо строковых литералов — enum (в `shared/contracts` — строковые union-типы: контракт без runtime).
- Вместо `null`-полей «в зависимости от режима» — разные типы (дискриминированные объединения).
- `readonly` для полей, которые не меняются после создания.
- Неизвестные данные извне (JSON, ответы API, env) — `unknown` + проверка, а не приведение типа.

---

## 11. Ошибки и валидация

- Бросаем **типизированные доменные исключения**: класс `extends DomainException` с `kind`
  (`DomainErrorKind`), `code` (`ApiErrorCode`) и ключом сообщения (`AdminMessageKey` / ключ `shared/messages`).
- Не возвращаем `null`/`false`/`-1` как сигнал ошибки.
- Маппинг исключений в HTTP — один глобальный `ApiExceptionFilter`: тело ошибки
  `{ statusCode, error, key, values?, details? }` (`shared/contracts/errors.ts`), `Cache-Control: no-store`.
- Валидация DTO — `class-validator` с ключами: `ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max })`.
  Ответ — `400 { error: 'validation', fields: { "<путь>": { key, values } } }`. Лишние поля запрещены.
- Ловим исключение, только если можем **что-то сделать**: повторить, преобразовать с контекстом, деградировать.
- Пустой `catch` и `catch { log; }` без решения — запрещены. При перебросе сохраняем причину (`cause`).
- Сбой внешнего источника не роняет весь сценарий: `warn` с контекстом, сценарий продолжается без этих данных.

```ts
// ✅ src/usecases/public/health/get/health.usecase.ts
private async checkDependency(name: string, check: () => Promise<void>): Promise<DependencyState> {
  try {
    await check();
    return HealthUsecase.UP;
  } catch (error: unknown) {
    this.logger.warn('HealthUsecase : dependency is down', { dependency: name, error: … });
    return HealthUsecase.DOWN;
  }
}
```

---

## 12. Данные: Prisma и SQL

- Схема — в `prisma/models/*.prisma` (один файл — одна модель или тесная группа), `datasource.prisma`,
  `generator.prisma`. Id — `String @id @default(dbgenerated("uuidv7()")) @db.Uuid`, поля `camelCase` с
  `@map("snake_case")`, таблицы `@@map("plural_snake_case")`, `createdAt`/`updatedAt` → `created_at`/`updated_at`.
- Изменение схемы: `npm run prisma:migration -- --name <что>` (create-only) → инварианты, которых не выразить
  в Prisma (CHECK), дописать в `migration.sql` → `npm run prisma:deploy`. Миграции — только вперёд.
- Явный `select` вместо выборки всей строки; любой список — с лимитом и пагинацией.
- Форма запроса постоянна: вариативность — значениями параметров, принципиально разные запросы — разные методы.
- `$queryRaw` — только тегированным шаблоном (значения уходят параметрами):

```ts
// ❌ Склейка: запрос меняет форму и открыт для инъекций
await this.database.client.$queryRawUnsafe(`SELECT id FROM leads WHERE status = '${status}'`);

// ✅ Параметры
await this.database.client.$queryRaw`SELECT id FROM leads WHERE status = ${status}::lead_status LIMIT ${limit}`;
```

- Конкурентные изменения — атомарно в одном запросе (`updateMany` с условием и проверкой `count`) или в транзакции.
- Repository возвращает доменные объекты/интерфейсы, а не «сырые строки» Prisma.

---

## 13. Логирование

- `private readonly logger = new Logger(Class.name)` — пишет через `AppLogger` (JSON-строки; при `LOG_DIR` —
  ещё и в файл). `console.*` запрещён.
- Формат сообщения: `'<Компонент> : <событие>'`, контекст — отдельным объектом в `snake_case`:
  `this.logger.log('LoginUsecase : signed in', { user_id: user.id })`.
- Уровни: `log` — значимое событие, `warn` — деградация без падения, `error` — сценарий не выполнен (5xx логирует фильтр).
- **Нельзя логировать:** персональные данные (имя, телефон, e-mail, текст заявки), токены, пароли, ключи,
  полные тела запросов/ответов. `AppLogger` дополнительно маскирует поля `password`, `token`, `authorization` и т. п.
- Не логируем то, что уже логирует инфраструктура (фильтр исключений, Nest).

---

## 14. Тесты

| Вид | Что проверяет | Как |
|---|---|---|
| **Unit** (`*.test.ts`) | Доменные классы, модули, стратегии | `node:test`, ручные стабы зависимостей (`InMemorySessionRepository`, `RecordingSleeper`), без БД и сети |
| **E2E** (`*.e2e.test.ts`) | Endpoint целиком | `TestApp` (настоящее приложение на случайном порту), `ApiClient` (fetch), база `gadyuka_test` + MinIO из `docker-compose.yml` |

- `npm test` — сборка, миграции тестовой базы, все тесты по `dist/`; `npm run test:unit` — без инфраструктуры.
- Тест проверяет **поведение**, а не реализацию. Сломали фичу — тест обязан упасть.
- Не мокаем класс, который тестируем.
- Один тест — один сценарий; имя описывает ожидание: `'refuses a wrong password and an unknown login the same way'`.
- Структура Arrange / Act / Assert.
- E2E-тест создаёт свои данные (`TestAdmin.create`) и удаляет их; лимиты по IP разводит `TestClientIp.random()`.
- Исправление бага начинается с теста, который его воспроизводит.

---

## 15. Антипаттерны и рефакторинг

| Запах | Признак | Лечение |
|---|---|---|
| Длинный метод | > 10 строк | Extract Method в `private` |
| Флаг-аргумент | `fn(x, true)` | Разделить на два метода |
| Switch по типу | `if (type === …)` в нескольких местах | Strategy + карта |
| Глубокая иерархия | `A extends B extends C` | Один уровень + композиция |
| Открытое состояние | `public` поля, сеттеры, правила снаружи | Инкапсуляция: `private` + методы-действия |
| God class | > ~200 строк, > 7 зависимостей | Разделить по ответственностям |
| Анемичная модель | Доменный класс — только поля | Перенести поведение в домен |
| Primitive obsession | `string` для slug, `number` для цены | Value Object |
| Длинный список параметров | > 3 параметров | Объект-параметр |
| Магические значения | `if (status === 3)`, `'admin.auth.throttled'` в коде | Enum / константа (`AdminMessageKey`) |
| Утилитный мусорник | `utils.ts` с функциями | Методы владеющих классов |
| Текст в ответе API | `throw new BadRequestException('Неверный пароль')` | Доменное исключение с ключом сообщения |
| Спекулятивная общность | Абстракция с одной реализацией «на будущее» | Удалить (YAGNI) |
| Комментарий вместо имени | `// считаем лимит` над блоком | Extract Method |

### Комментарии

- Код объясняет **что**, комментарий — только **почему** (неочевидное решение, ограничение внешней системы).
- Закомментированный код удаляем — он есть в git.
- `TODO` — только со ссылкой на задачу.

---

## 16. Git и процесс

- Ветка от основной: `feat/<TASK>/<short-name>`, `fix/<TASK>/<short-name>`.
- Коммиты — Conventional Commits: `feat: …`, `fix: …`, `refactor: …`, `test: …`, `docs: …` (проверяет commitlint).
- Один коммит — одно логическое изменение. Рефакторинг и изменение поведения — разными коммитами.
- Перемещение файлов — `git mv`.
- Хуки husky стоят на весь репозиторий (`npm ci` в `backend/` выполняет `husky:prepare`):
  pre-commit — lint-staged для `backend/`, `frontend/` и `shared/` (каждый своими инструментами),
  commit-msg — commitlint, pre-push — линт без исправлений. Обходить через `--no-verify` нельзя.
- Новые эндпоинты — через генератор (`npm run gen:usecase`), чтобы структура была единой.
- Большая задача: изучение → план → вопросы → согласование → код.

---

## 17. Чек-лист ревью

**Структура**
- [ ] Логика только в методах классов, нет свободных функций и `utils.ts`.
- [ ] Каждый класс — одна ответственность; файл — один экспортируемый класс.
- [ ] Импорты идут только «вниз» по слоям, через алиасы.
- [ ] Состояние инкапсулировано: `private`, без публичных изменяемых полей и сеттеров.
- [ ] Наследование классов — не глубже одного уровня; общее вынесено композицией.

**Методы**
- [ ] Тело ≤ 10 строк, вложенность ≤ 2, параметров ≤ 3.
- [ ] Имя полностью описывает действие, нет «And».
- [ ] Нет `boolean`-параметров и флагов-режимов.
- [ ] Command/Query разделены.

**API и данные**
- [ ] Доступ задан явно: `@Public()` / `@Roles([…])`; `x-internal-key` не отключён без причины.
- [ ] DTO валидирует каждое поле с ключом сообщения; ответ `implements` контракт `shared/contracts`.
- [ ] Запросы параметризованы, с `select` и лимитом; конкурентные изменения атомарны.
- [ ] Изменение схемы — миграция с CHECK-инвариантами.

**Ошибки и логи**
- [ ] Ошибки — доменные исключения с ключами; ничего не проглочено; внешние сбои деградируют.
- [ ] Логи в формате проекта, без ПДн и секретов.

**Тесты**
- [ ] Unit-тесты на домен/модули, e2e на endpoint; тесты падают, если сломать фичу.
- [ ] `npm run lint` и `npm test` проходят.
