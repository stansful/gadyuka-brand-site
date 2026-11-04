# CLAUDE.md

Инструкции для AI-агента, который пишет код бэкенда ГАДЮКИ (`backend/`). Правила обязательны.
При конфликте с привычками модели или «общепринятыми» практиками побеждает этот файл.
Подробности, мотивация и примеры — в [CONTRIBUTING.md](CONTRIBUTING.md). Запуск, скрипты, env — в [../README.md](../README.md).

## Стек

- TypeScript (`strict: true`), NestJS 12 на **NodeAdapter (`@nestjs/platform-node`)**, Node.js (версия — `.nvmrc`), CommonJS-сборка `tsc` + `tsc-alias`.
- PostgreSQL 18 через Prisma 7 (`@prisma/adapter-pg`), схема разбита по файлам в `prisma/models/`.
- Файлы — `@nestjs/storage` (S3Disk → MinIO), картинки — `sharp`, тексты — `shared/messages` + ICU (`intl-messageformat`).
- Валидация — `class-validator` + `class-transformer`; Swagger — `@nestjs/swagger` (только `NODE_ENV=dev`).
- Сессии — своя обёртка над `@nestjs/jwt` (access JWT + refresh-токен в БД); перебор пароля — `@nestjs/throttler`.
- Тесты — встроенный `node:test` по собранному `dist/`; линт и формат — `oxlint` + `oxfmt`; генератор — `hygen`.
- ❌ Не добавлять без согласования: zod, dotenv, `@nestjs/config`, passport, jest/vitest/supertest, AWS SDK, file-type, jose.
- Форматирование и линт — командами из `package.json` (`npm run lint`); перед завершением задачи прогнать их.

## Порядок работы

1. Большая задача: изучить код → составить план → задать вопросы с вариантами по умолчанию → ждать подтверждения. Код до подтверждения не писать.
2. Новый эндпоинт создавать генератором: `npm run gen:usecase` (hygen, `_templates/usecase/new`; для области — `--slice <папка>`), а не с нуля; затем зарегистрировать его в модуле своей области (генератор печатает, что добавить; таблица модулей — `../README.md`, раздел «Areas»). Весь путь фичи — контракт `shared/contracts` → usecase бэкенда → вызов во фронтенде — описан в `../../shared/contracts/README.md` («Adding an endpoint end to end»). Фронтенд только отображает: правила, валидация и данные — здесь.
3. Перед добавлением класса/метода — найти существующий и переиспользовать (`src/module/*`, `src/core/*`, общие помощники форм админки — `src/usecases/admin/common/*`). Новый код — только если подходящего нет; одинаковый код двух областей — вынести в общее место, а не копировать.
4. Закончил — `npm run lint`, `npm test` (unit параллельно, e2e по одному файлу: нужен `docker compose up -d`). Во время работы — `npm run test:slice -- <область>` (своя сборка `.build/<область>`, своя база `gadyuka_test_<область>`). Сообщить результат честно, с выводом при падении.

## Абсолютные запреты

- ❌ Свободные функции: `export const fn = () => …`, `export function fn()`, файлы `utils.ts`/`helpers.ts` с функциями. Вся логика — методы классов. Исключение — декораторы Nest, созданные фабриками (`Reflector.createDecorator`, `createParamDecorator(Class.method)`).
- ❌ `boolean`-параметры у методов. Флаг = два метода с разными именами (`formatForOwner()` / `formatPreview()`).
- ❌ Тело метода длиннее **10 строк** (без учёта сигнатуры и закрывающей скобки). Длиннее — выносить шаги в `private`-методы.
- ❌ `if`/`switch`/тернарники по типу сущности для выбора поведения. Только стратегии в карте `Record<Enum, Strategy>` или фабрика.
- ❌ Парные методы `notifyAboutTailoring()` / `notifyAboutPartnership()`. Один метод с параметром-enum и стратегиями.
- ❌ `any`, `as unknown as`, `// @ts-ignore`, `!` (non-null assertion) без комментария-обоснования.
- ❌ Наследование классов глубже одного уровня. Базовый класс ни от кого не наследуется (кроме классов фреймворка: `Error`, `ValidationPipe`, `ThrottlerGuard`, `ConsoleLogger`). Общий код — композицией. Интерфейсы и типы можно расширять и комбинировать свободно.
- ❌ Публичные изменяемые поля и сеттеры. Состояние — `private`, изменения — методами-действиями с проверкой инвариантов.
- ❌ Пустой `catch`, `catch` с одним логом, проглатывание ошибок.
- ❌ `console.*` — только `Logger` полем класса: `private readonly logger = new Logger(Class.name)` (он пишет через `AppLogger`).
- ❌ `process.env` вне `src/config` (и `prisma.config.ts`). Переменные окружения — только через `ConfigService` с валидацией.
- ❌ Текст для пользователя в ответах API. Ошибки и валидация отдают **ключи** `shared/messages` (+ ICU-значения), переводит фронтенд.
- ❌ Конкатенация значений в SQL; склейка запроса из условных фрагментов; флаги-режимы в построителях запросов. `$queryRaw` — только тегированным шаблоном (параметры).
- ❌ Логика в контроллере; Prisma в usecase; бизнес-правила в repository; I/O в доменном классе (`src/core`).
- ❌ Магические строки и числа — только enum и именованные константы (`src/core/constants`, `*.constants.ts`, `static readonly`).
- ❌ Персональные данные (имя, телефон, e-mail, текст заявки), секреты, токены, целые payload'ы в логах.
- ❌ Закомментированный код, `TODO` без ссылки на задачу.

## Обязательно

- ✅ ООП: инкапсуляция (скрытое состояние, инварианты в конструкторе/`static create`), абстракция (зависимость от интерфейса), полиморфизм (реализации одного интерфейса вместо `if` по типу), наследование — только Template Method в один уровень.
- ✅ Composition over inheritance: общий код — отдельный класс, внедрённый через конструктор.
- ✅ Один класс — одна ответственность. Один файл — один экспортируемый класс (+ его интерфейсы/типы).
- ✅ Имя метода = глагол + объект и полностью описывает действие (`findServableKey`, `buildObjectKey`). Хочется «And» в имени — это два метода.
- ✅ Не больше 3 параметров; больше — один объект-параметр.
- ✅ Ранний возврат вместо вложенности; вложенность блоков ≤ 2.
- ✅ Метод либо меняет состояние (command), либо возвращает данные (query) — не оба.
- ✅ Зависимости — только через конструктор (DI), `private readonly`. Зависеть от интерфейса/токена, когда реализаций больше одной (`SESSION_REPOSITORY`, `TELEGRAM_FETCH`).
- ✅ Новый вариант поведения — новый класс-стратегия; существующие стратегии не трогать (Open/Closed).
- ✅ Контроллер передаёт поля DTO в `usecase.execute({...})` явно, по одному. Добавил поле в DTO — добавь в вызов, в контракт `shared/contracts` и в e2e-тест.
- ✅ Usecase возвращает класс-ответ (`*.response.ts`), который `implements` интерфейс из `shared/contracts`.
- ✅ Валидация DTO — декораторы `class-validator` с `ValidationMessage.of(<ключ>, <values>)`; ключ существует в `shared/messages` (unit-тест проверяет `AdminMessageKey`).
- ✅ Ошибки — типизированные доменные исключения (`extends DomainException`, `kind` + `code` + ключ); маппинг в HTTP — один глобальный `ApiExceptionFilter`. Ошибки Prisma P2002 / P2003 / P2025 ловить не нужно: фильтр сам отвечает 409 `admin.errors.duplicate` / 409 `admin.errors.related` / 404 `admin.errors.notFound`.
- ✅ Ключи сообщений: общие для нескольких областей (`admin.errors.*`, `admin.validation.*` общих правил) — `AdminMessageKey`, ключи одной области — её enum `src/core/constants/<область>-message-key.enum.ts`; тест `src/test/message-keys.test.ts` проверяет все такие enum по `shared/messages`.
- ✅ Запись строк `Message` (тексты сайта) → `SiteMessagesService.invalidate()` (`~module/site-messages`); тексты Telegram — `TelegramTexts` (перед `text()` — `await load()`, `notify` делает это сам).
- ✅ Доступ: глобальные гарды. По умолчанию нужен `x-internal-key` и access-токен; публичный маршрут — `@Public()`, админский — `@Roles([UserRole.ADMIN])` на контроллере; пользователь — `@CurrentUser()`. Правила проверяет для всех маршрутов `src/test/route-access.e2e.test.ts` — не ослаблять его; полноту Swagger — `src/swagger/swagger.setup.e2e.test.ts`.
- ✅ Списки — с пагинацией и лимитом; в Prisma — явный `select`.
- ✅ Изменение схемы: правка `prisma/models/*.prisma` → `npm run prisma:migration` → инварианты, которых не выразить в Prisma (CHECK), дописать SQL в миграцию.
- ✅ Сбой внешнего источника (Telegram, хранилище) не роняет весь сценарий: `warn` с контекстом и деградация.
- ✅ Каждое изменение поведения покрыто тестом: domain/strategy/module — unit (`*.test.ts`), endpoint — e2e (`*.e2e.test.ts`).
- ✅ Перемещение файлов — `git mv`, чтобы сохранить историю.

## Раскладка

```
backend/
├── prisma/                       datasource.prisma, generator.prisma, models/*.prisma, migrations/
├── _templates/usecase/new/       hygen: шаблоны эндпоинта
└── src/
    ├── main.ts / app.module.ts / app.factory.ts
    ├── config/                   ConfigModule/ConfigService + валидация env (class-validator)
    ├── database/                 DatabaseService (PrismaClient + PrismaPg), PostgresUrl
    ├── swagger/                  Swagger (только dev) + тест: документ описывает все маршруты
    ├── core/constants/           enum и константы (ключи сообщений, коды ошибок, заголовки, slug, id настроек)
    ├── core/<entity>/            доменные классы, enum, value objects (без Nest и I/O); общие для областей —
    │                             locales/ (LocalizedTextValue), reviews/, entities/, links/
    ├── module/<infra>/           инфраструктура: index.ts + src/*.module|service|constants|interfaces|test.ts
    │                             (hash, auth-token, storage, image, telegram, lead-notification, messages,
    │                             site-messages, logger, common)
    ├── usecases/{public,auth,admin}/[<область>/]<feature>/<method>/   (модули областей: ../README.md «Areas»)
    │   ├── <feature>.controller.ts / .usecase.ts / .repository.ts
    │   ├── <feature>.dto.ts / .response.ts / .route.ts
    │   └── <feature>.e2e.test.ts
    ├── usecases/admin/common/    общее для форм админки: RowIdPipe, LocalizedTextField, MediaRefRecord/Response,
    │                             PickedMediaChecker (AdminCommonModule)
    ├── guard/ decorator/ pipe/ exception/
    ├── cli/                      seed и другие команды (npm run db:seed; шаги по порядку — cli/seed/seed.steps.ts)
    └── test/                     помощники тестов (TestApp, ApiClient, TestAdmin, TestEnvironment)
../shared/contracts/              типы запросов/ответов API (общие с фронтендом)
../shared/messages/               тексты сайта и админки (ключи ошибок — отсюда); meta/site-texts.json — виды и
                                  обязательность текстов, порядок разделов, картинки лендинга
```

Зависимости направлены строго: controller → usecase → domain/repository → module. Обратных импортов нет.
Импорты — через алиасы (`~config`, `~core/*`, `~module/*`, `~usecases/*`, `~shared/*` …), внутри своей папки — относительные.

## Именование

- Файлы: `kebab-case.<role>.ts` — `lead-message.formatter.ts`, `media-keys.ts`, `login.usecase.ts`.
- Классы: `PascalCase` + суффикс роли — `Usecase`, `Repository`, `Strategy`, `Factory`, `Dto`, `Response`, `Guard`, `Exception`.
- Интерфейсы стратегий: `<Семейство>Strategy`/`<Семейство>Presenter`; реализации: `<Вариант><Семейство>…` (`OwnerLeadMessagePresenter`).
- Enum: `PascalCase`, члены `UPPER_SNAKE_CASE`. Перечисления БД — в `prisma/models/enums.prisma`, в `src/core` их реэкспорт.
- Таблицы и колонки БД: `snake_case`, таблицы во множественном числе (`@@map("news_items")`), id — `uuidv7()`.
- Булевы поля и методы-предикаты: `is*`, `has*`, `can*`.
- Без сокращений и шумовых слов (`data`, `info`, `manager`, `tmp`, `2`).

## Самопроверка перед ответом

- [ ] Нет свободных функций и `boolean`-параметров.
- [ ] Каждый метод ≤ 10 строк, ≤ 3 параметров, вложенность ≤ 2.
- [ ] Ветвление по типу — стратегии/фабрика.
- [ ] Наследование классов ≤ 1 уровня, состояние инкапсулировано.
- [ ] Новое поле проброшено: DTO → контроллер → usecase → контракт → e2e.
- [ ] Ошибки — доменные исключения с ключами `shared/messages`; ничего не проглочено; логи без ПДн.
- [ ] Запросы параметризованы, с `select` и лимитом.
- [ ] `npm run lint` и `npm test` прогнаны; результат указан в ответе.
